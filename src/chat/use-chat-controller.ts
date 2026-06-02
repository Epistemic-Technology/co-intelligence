import { Accessor, createSignal } from "solid-js";
import { App, Notice } from "obsidian";

import { CoIntelligencePlugin } from "@/CoIntelligencePlugin";
import { ModelRegistry } from "@/services/model-registry";
import {
    cancelChatResponse,
    deleteAbortControllerForRequest,
    generateChatResponse,
} from "@/services/model-service";
import type { ChatRequest, ContextItems, Model } from "@/types";

import { DEFAULT_MAX_STEPS } from "@/agent/agent-loop";
import { currentPlatform } from "@/agent/tools";
import type { PermissionBroker } from "@/agent/permission-broker";
import type { ToolRegistry } from "@/agent/tool-registry";

import { buildChatRequest } from "@/chat/request-builder";
import {
    extractMarkdownLinkSources,
    processNumberedSources,
} from "@/chat/source-processor";
import { consumeChatStream } from "@/chat/stream-consumer";
import { loadSystemPrompt } from "@/chat/system-prompt-loader";
import type { SessionStore } from "@/session/session-store";
import { messageText, sessionMessagesToModelMessages } from "@/session/types";
import { getContext } from "@/utils/model-context";

export interface UseChatControllerParams {
    app: App;
    plugin: CoIntelligencePlugin;
    registry: ModelRegistry;
    model: Accessor<Model | null>;
    contextItems: Accessor<ContextItems | null>;
    store: SessionStore;
    /** Optional — when omitted, tool calls are disabled for the controller. */
    tools?: ToolRegistry;
    /** Optional — used to gate approval-required tools. */
    permissionBroker?: PermissionBroker;
    /** Fires after each successful assistant response completes (post sources). */
    onAssistantResponseComplete?: () => void;
}

export interface ChatController {
    isProcessing: Accessor<boolean>;
    /** Step index of the in-flight agent loop. 0 when idle, 1 on the first model
     * call, incremented on each subsequent `start-step` event. */
    currentStep: Accessor<number>;
    /** Hard ceiling on agent-loop steps (mirrors `stopWhen: stepCountIs(N)`). */
    maxSteps: Accessor<number>;
    send: (
        message: string,
        webSearchEnabled?: boolean,
        systemPromptPath?: string,
    ) => Promise<void>;
    cancel: () => void;
}

/**
 * Drives one chat send/cancel orchestration against a {@link SessionStore}.
 * Mutates the store via named actions — every session change goes through the
 * store, so persistence layers can observe a single update channel.
 */
export function useChatController(
    params: UseChatControllerParams,
): ChatController {
    const {
        app,
        plugin: _plugin,
        registry,
        model,
        contextItems,
        store,
        tools,
        permissionBroker,
        onAssistantResponseComplete,
    } = params;

    const [isProcessing, setIsProcessing] = createSignal<boolean>(false);
    const [currentRequest, setCurrentRequest] =
        createSignal<ChatRequest | null>(null);
    const [currentAssistantId, setCurrentAssistantId] = createSignal<
        string | null
    >(null);
    const [currentStep, setCurrentStep] = createSignal<number>(0);
    // Static for now; Phase 5 #69 wires per-session overrides into here.
    const [maxSteps] = createSignal<number>(DEFAULT_MAX_STEPS);
    /**
     * Set by `cancel()`, read by the stream error handlers so they treat the
     * resulting AbortError as expected silence rather than a real failure.
     * Reset at the start of every `send()`.
     */
    let cancelled = false;

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

        cancelled = false;
        setCurrentStep(0);
        store.appendUserMessage(message);
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
            messages: sessionMessagesToModelMessages(store.session.messages),
            context: parsedContext,
            webSearch: webSearchEnabled,
            systemPrompt,
        });
        setCurrentRequest(request);
        store.setLastModelId(requestModel.id);

        const assistantId = store.beginAssistantMessage();
        setCurrentAssistantId(assistantId);

        try {
            const sdkTools = tools
                ? tools.toAiSdkTools({
                      platform: currentPlatform(),
                      permissionBroker,
                  })
                : {};
            const responseStream = generateChatResponse(
                request,
                registry,
                sdkTools,
            );
            let isFirstChunk = true;
            let streamError: unknown = null;

            try {
                for await (const event of consumeChatStream(
                    responseStream.events,
                )) {
                    if (event.type === "error") {
                        if (cancelled || isAbortError(event.error)) {
                            continue;
                        }
                        streamError = event.error;
                        console.error("Error:", event.error);
                        new Notice(
                            "Error generating response: " +
                                ((event.error as Error)?.message ??
                                    "see console for details"),
                            0,
                        );
                        continue;
                    }
                    if (event.type === "text") {
                        if (isFirstChunk) {
                            isFirstChunk = false;
                            setIsProcessing(false);
                        }
                        store.appendAssistantText(assistantId, event.text);
                        continue;
                    }
                    if (event.type === "tool-call") {
                        store.addToolCallPart(assistantId, {
                            type: "tool-call",
                            toolCallId: event.toolCallId,
                            toolName: event.toolName,
                            input: event.input,
                            status: "running",
                        });
                        continue;
                    }
                    if (event.type === "tool-result") {
                        store.updateToolCallStatus(
                            assistantId,
                            event.toolCallId,
                            "success",
                        );
                        store.addToolResultPart(assistantId, {
                            type: "tool-result",
                            toolCallId: event.toolCallId,
                            toolName: event.toolName,
                            output: event.output,
                        });
                        continue;
                    }
                    if (event.type === "tool-error") {
                        store.updateToolCallStatus(
                            assistantId,
                            event.toolCallId,
                            "error",
                        );
                        store.addToolResultPart(assistantId, {
                            type: "tool-result",
                            toolCallId: event.toolCallId,
                            toolName: event.toolName,
                            output:
                                (event.error as Error)?.message ??
                                String(event.error),
                            isError: true,
                        });
                        continue;
                    }
                    if (event.type === "start-step") {
                        setCurrentStep((n) => n + 1);
                        continue;
                    }
                    // approval-requested / finish / finish-step /
                    // tool-input-delta: not surfaced in the session today
                    // (Phase 5 wires the rest in).
                }
            } catch (error) {
                if (cancelled || isAbortError(error)) {
                    // Expected: cancel() already wrote the cancellation
                    // message and aborted the request.
                } else {
                    streamError = error;
                    console.error("Caught error:", error);
                    if ((error as Error).message) {
                        new Notice(
                            "Error generating response: " +
                                (error as Error).message,
                            0,
                        );
                    }
                }
            }

            const assistantMessage = store.session.messages.find(
                (m) => m.id === assistantId,
            );
            const hasAnyParts = (assistantMessage?.parts.length ?? 0) > 0;
            if (streamError && !hasAnyParts) {
                const message =
                    (streamError as Error)?.message ?? String(streamError);
                store.appendAssistantText(
                    assistantId,
                    `*Error: ${message}*`,
                );
                setIsProcessing(false);
            } else if (!hasAnyParts) {
                store.appendAssistantText(
                    assistantId,
                    "No response received from the model.",
                );
                setIsProcessing(false);
            }

            const rawSources = await responseStream.sources;

            if (rawSources.length > 0) {
                const currentText = messageText(
                    store.session.messages.find((m) => m.id === assistantId)!,
                );
                const processed = processNumberedSources({
                    rawSources,
                    content: currentText,
                    offset: store.session.sources.length,
                });
                store.replaceLastTextPart(assistantId, processed.content);
                store.addSources(processed.newSources);
            } else {
                const currentText = messageText(
                    store.session.messages.find((m) => m.id === assistantId)!,
                );
                const newLinkSources = extractMarkdownLinkSources({
                    content: currentText,
                    existingSources: store.session.sources,
                });
                if (newLinkSources.length > 0) {
                    store.addSources(newLinkSources);
                }
            }

            onAssistantResponseComplete?.();
        } catch (error) {
            const errorMessage = (error as Error).message || "Unknown error";
            new Notice("Error generating response: " + errorMessage);
            console.error("Error generating response:", error);
            setIsProcessing(false);
            store.appendAssistantText(
                assistantId,
                "Sorry, there was an error generating a response. Please try again.",
            );
        } finally {
            setIsProcessing(false);
            setCurrentStep(0);
            setCurrentRequest(null);
            deleteAbortControllerForRequest(request);
        }
    };

    const cancel = () => {
        setIsProcessing(false);
        setCurrentStep(0);
        const request = currentRequest();
        if (!request) return;
        cancelled = true;
        cancelChatResponse(request);

        const assistantId = currentAssistantId();
        if (assistantId) {
            const message = store.session.messages.find(
                (m) => m.id === assistantId,
            );
            for (const part of message?.parts ?? []) {
                if (part.type !== "tool-call") continue;
                if (part.status !== "running") continue;
                store.updateToolCallStatus(
                    assistantId,
                    part.toolCallId,
                    "error",
                );
                store.addToolResultPart(assistantId, {
                    type: "tool-result",
                    toolCallId: part.toolCallId,
                    toolName: part.toolName,
                    output: "Tool call cancelled by user",
                    isError: true,
                });
            }
        }

        const cancelId = store.beginAssistantMessage();
        store.appendAssistantText(cancelId, "*Request cancelled by user*");
    };

    return { isProcessing, currentStep, maxSteps, send, cancel };
}

/**
 * AI SDK / fetch aborts surface as DOMException("AbortError") or wrapped
 * errors whose message mentions "abort". We treat these as expected when the
 * user clicked Cancel, so they don't pop a Notice.
 */
function isAbortError(error: unknown): boolean {
    if (!error) return false;
    const e = error as { name?: string; message?: string };
    if (e.name === "AbortError") return true;
    if (typeof e.message === "string" && /abort/i.test(e.message)) {
        return true;
    }
    return false;
}
