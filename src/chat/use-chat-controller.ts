import { Accessor, createEffect, createSignal } from "solid-js";
import { App, debounce, Notice } from "obsidian";

import { CoIntelligencePlugin } from "@/CoIntelligencePlugin";
import { ModelRegistry } from "@/services/model-registry";
import {
    cancelChatResponse,
    deleteAbortControllerForRequest,
    generateChatResponse,
    generateChatTitle,
} from "@/services/model-service";
import type {
    ChatRequest,
    ContextItems,
    Model,
    ModelChatMessage,
    Source,
} from "@/types";
import { HandleChatChangeProps } from "@/ChatView";

import { buildChatRequest } from "@/chat/request-builder";
import {
    extractMarkdownLinkSources,
    processNumberedSources,
} from "@/chat/source-processor";
import { consumeChatStream } from "@/chat/stream-consumer";
import { loadSystemPrompt } from "@/chat/system-prompt-loader";
import { getContext } from "@/utils/model-context";

export interface UseChatControllerParams {
    app: App;
    plugin: CoIntelligencePlugin;
    registry: ModelRegistry;
    model: Accessor<Model | null>;
    contextItems: Accessor<ContextItems | null>;
    initialMessages: ModelChatMessage[];
    initialSources?: Source[];
    onChange?: (props: HandleChatChangeProps) => void;
}

export interface ChatController {
    messages: Accessor<ModelChatMessage[]>;
    sources: Accessor<Source[]>;
    isProcessing: Accessor<boolean>;
    send: (
        message: string,
        webSearchEnabled?: boolean,
        systemPromptPath?: string,
    ) => Promise<void>;
    cancel: () => void;
}

/**
 * Owns the chat send/cancel orchestration and the message/source state that
 * the in-flight request mutates. Caller still owns model and contextItems
 * accessors (driven by sibling UI components) and provides them as inputs.
 *
 * Phase 1 stepping stone: in Phase 2 this hook is replaced by a session
 * `createStore` shared across the plugin.
 */
export function useChatController(
    params: UseChatControllerParams,
): ChatController {
    const {
        app,
        plugin,
        registry,
        model,
        contextItems,
        initialMessages,
        initialSources = [],
        onChange,
    } = params;

    const [messages, setMessages] =
        createSignal<ModelChatMessage[]>(initialMessages);
    const [sources, setSources] = createSignal<Source[]>(initialSources);
    const [lastSourceLinkNumber, setLastSourceLinkNumber] =
        createSignal<number>(initialSources.length);
    const [isProcessing, setIsProcessing] = createSignal<boolean>(false);
    const [currentRequest, setCurrentRequest] =
        createSignal<ChatRequest | null>(null);

    const triggerChange = debounce(async (regenNoteTitle: boolean = false) => {
        let newTitle = "";
        if (regenNoteTitle) {
            newTitle = await generateChatTitle(messages(), plugin);
        }
        if (onChange) {
            const currentModelId = currentRequest()?.modelId;
            onChange({
                newMessages: messages(),
                newTitle,
                contextItems: contextItems(),
                lastModelId: currentModelId || null,
                sources: sources(),
            });
        }
    }, 750);

    createEffect(() => {
        contextItems();
        sources();
        messages();
        triggerChange();
    });

    const send = async (
        message: string,
        webSearchEnabled: boolean = false,
        systemPromptPath?: string,
    ) => {
        if (!message.trim()) {
            new Notice("Warning: sending empty user message");
            console.warn("Message is empty");
            return;
        }
        const requestModel = model();
        if (!requestModel) {
            new Notice("No model selected while sending message");
            console.error("No model selected while sending message");
            return;
        }

        const newMessage: ModelChatMessage = {
            role: "user",
            content: message,
        };
        setMessages([...messages(), newMessage]);
        setIsProcessing(true);

        const parsedContext = await getContext(contextItems(), app);

        let systemPrompt: string | undefined;
        try {
            systemPrompt = await loadSystemPrompt(systemPromptPath, app);
        } catch (error) {
            console.error("Error loading system prompt:", error);
            new Notice(
                "Error loading system prompt: " + (error as Error).message,
            );
        }

        const request = buildChatRequest({
            model: requestModel,
            messages: messages(),
            context: parsedContext,
            webSearch: webSearchEnabled,
            systemPrompt,
        });
        setCurrentRequest(request);

        try {
            setIsProcessing(true);
            const responseStream = generateChatResponse(request, registry);
            let accumulatedContent = "";
            let isFirstChunk = true;

            try {
                for await (const event of consumeChatStream(
                    responseStream.events,
                )) {
                    if (event.type === "error") {
                        console.error("Error:", event.error);
                        new Notice(
                            "Unknown error occurred. See console log for details.",
                        );
                        continue;
                    }
                    if (event.type !== "text") {
                        continue;
                    }
                    const text = event.text;
                    if (isFirstChunk) {
                        const assistantMessage: ModelChatMessage = {
                            role: "assistant",
                            content: text,
                        };
                        setMessages([...messages(), assistantMessage]);
                        accumulatedContent += text;
                        isFirstChunk = false;
                        setIsProcessing(false);
                    } else {
                        accumulatedContent += text;
                        setMessages((prevMessages) => {
                            const updatedMessages = [...prevMessages];
                            updatedMessages[updatedMessages.length - 1] = {
                                role: "assistant",
                                content: accumulatedContent,
                            };
                            return updatedMessages;
                        });
                    }
                }
            } catch (error) {
                console.error("Caught error:", error);
                if ((error as Error).message) {
                    new Notice(
                        "Error generating response: " +
                            (error as Error).message,
                        0,
                    );
                }
            }

            if (isFirstChunk) {
                setIsProcessing(false);
                setMessages([
                    ...messages(),
                    {
                        role: "assistant",
                        content: "No response received from the model.",
                    },
                ]);
            }

            const lastMessage = messages()[messages().length - 1];
            const rawSources = await responseStream.sources;

            if (rawSources.length > 0) {
                const processed = processNumberedSources({
                    rawSources,
                    content: (lastMessage.content as string) ?? "",
                    offset: lastSourceLinkNumber(),
                });
                setMessages((prevMessages) => {
                    const updatedMessages = [...prevMessages];
                    updatedMessages[updatedMessages.length - 1] = {
                        ...lastMessage,
                        content: processed.content,
                    } as ModelChatMessage;
                    return updatedMessages;
                });
                setSources([...sources(), ...processed.newSources]);
                setLastSourceLinkNumber(
                    lastSourceLinkNumber() + processed.newSources.length,
                );
            } else {
                const currentMessage = messages()[messages().length - 1];
                const newLinkSources = extractMarkdownLinkSources({
                    content: (currentMessage.content as string) ?? "",
                    existingSources: sources(),
                });
                if (newLinkSources.length > 0) {
                    setSources([...sources(), ...newLinkSources]);
                    setLastSourceLinkNumber(
                        lastSourceLinkNumber() + newLinkSources.length,
                    );
                }
            }
            triggerChange(true);
        } catch (error) {
            const errorMessage = (error as Error).message || "Unknown error";
            new Notice("Error generating response: " + errorMessage);
            console.error("Error generating response:", error);
            setIsProcessing(false);
            setMessages((prevMessages) => [
                ...prevMessages,
                {
                    role: "assistant",
                    content:
                        "Sorry, there was an error generating a response. Please try again.",
                },
            ]);
            triggerChange();
        } finally {
            setIsProcessing(false);
            setCurrentRequest(null);
            deleteAbortControllerForRequest(request);
        }
    };

    const cancel = () => {
        setIsProcessing(false);
        const request = currentRequest();
        if (!request) return;
        cancelChatResponse(request);

        const cancelMessage: ModelChatMessage = {
            role: "assistant",
            content: "*Request cancelled by user*",
        };
        setMessages((prevMessages) => [...prevMessages, cancelMessage]);
        triggerChange();
    };

    return { messages, sources, isProcessing, send, cancel };
}
