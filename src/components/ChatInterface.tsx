import { createSignal, useContext, Show, createEffect } from "solid-js";
import { CoreMessage } from "ai";
import { TFile, Notice } from "obsidian";

import { ModelRegistry } from "@/services/model-registry";
import {
  cancelChatResponse,
  deleteAbortControllerForRequest,
  generateChatResponse,
  generateChatTitle,
} from "@/services/model-service";
import {
  ContextItemContent,
  ChatRequest,
  Source,
  CoiNoteFrontmatter,
  Model,
  ModelId,
  ContextItems,
  Tag,
} from "@/types";
import { debounce } from "@/utils/debounce";
import { PluginContext, AppContext } from "@/CoiChatApp";
import { ChatHistory } from "@/components/ChatHistory";
import { UserInput } from "@/components/UserInput";
import { ContextList } from "@/components/ContextList";
import { SourceList } from "@/components/SourceList";

import { getContext } from "@/utils/model-context";
import { HandleChatChangeProps } from "@/ChatView";
import { BotMessage } from "@/components/BotMessage";
import { UserMessage } from "@/components/UserMessage";

export interface ChatInterfaceProps {
  initialMessages: CoreMessage[];
  initialContext?: ContextItems | null;
  initialSources?: Source[];
  onChange?: (props: HandleChatChangeProps) => void;
}

export const ChatInterface = ({
  initialMessages,
  initialContext = null,
  initialSources = [],
  onChange,
}: ChatInterfaceProps) => {
  const plugin = useContext(PluginContext);

  if (!plugin) {
    throw new Error("Plugin Context is not available");
  }
  const registry = ModelRegistry.getInstance(plugin);
  const modelSetting = plugin.settings.defaultModel;
  let currentModel: Model | null = null;
  if (modelSetting) {
    currentModel = registry.getModel(modelSetting as ModelId);
  } else {
    currentModel = registry.getDefaultModel();
  }

  const [model, setModel] = createSignal<Model | null>(currentModel);
  const [messages, setMessages] = createSignal<CoreMessage[]>(initialMessages);
  const [contextItems, setContextItems] = createSignal<ContextItems | null>(
    initialContext,
  );
  const [sources, setSources] = createSignal<Source[]>(initialSources);
  const [lastSourceLinkNumber, setLastSourceLinkNumber] = createSignal<number>(
    initialSources.length,
  );
  const [isProcessing, setIsProcessing] = createSignal<boolean>(false);
  const [currentRequest, setCurrentRequest] = createSignal<ChatRequest | null>(
    null,
  );

  const app = useContext(AppContext);

  if (!app) {
    throw new Error("App Context is not available");
  }

  const handleLinkNote = (file: TFile) => {
    const items = contextItems();
    if (items === null) {
      setContextItems({
        notes: [file],
        tags: [],
        sources: [],
      });
    } else if (!items.notes.some((note) => note.path === file.path)) {
      setContextItems({
        notes: [...items.notes, file],
        tags: items.tags,
        sources: items.sources,
      });
    }
    triggerChange();
  };

  const handleAddTag = (tag: Tag) => {
    const items = contextItems();
    if (items === null) {
      setContextItems({
        notes: [],
        tags: [tag],
        sources: [],
      });
    } else if (!items.tags.includes(tag)) {
      setContextItems({
        notes: items.notes,
        tags: [...items.tags, tag],
        sources: items.sources,
      });
    }
    triggerChange();
  };

  const handleSendMessage = async (
    message: string,
    webSearchEnabled: boolean = false,
  ) => {
    if (!message.trim()) {
      new Notice("Warning: Sending empty user message");
      console.warn("Message is empty");
      return;
    }
    if (!model()) {
      new Notice("No model selected while sending message");
      console.error("No model selected while sending message");
      return;
    }
    if (!app) {
      new Notice("No app instance while sending message");
      console.error("No app instance while sending message");
      return;
    }
    const newMessage: CoreMessage = { role: "user", content: message };
    setMessages([...messages(), newMessage]);
    setIsProcessing(true);

    const parsedContext = await getContext(contextItems(), app);

    const request: ChatRequest = {
      requestID: crypto.randomUUID(),
      modelId: (model() as Model).id,
      messages: [...messages()],
      context: parsedContext,
      webSearch: webSearchEnabled,
    };
    setCurrentRequest(request);

    try {
      setIsProcessing(true);
      const responseStream = await generateChatResponse(request, registry);
      let accumulatedContent = "";
      let isFirstChunk = true;
      let chunk;

      try {
        for await (chunk of responseStream.textStream) {
          if (isFirstChunk) {
            const assistantMessage: CoreMessage = {
              role: "assistant",
              content: chunk,
            };
            setMessages([...messages(), assistantMessage]);
            accumulatedContent = chunk;
            isFirstChunk = false;
            setIsProcessing(false);
          } else {
            accumulatedContent += chunk;
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
            "Error generating response: " + (error as Error).message,
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

      // Handle new sources. Renumber and link Perplexity-style references
      const newSources = await responseStream.sources;
      if (newSources.length > 0) {
        // Replace source reference numbers [n] with [n+offset]
        const offset = lastSourceLinkNumber();
        const updatedContent = (lastMessage.content as string).replace(
          /\[(\d+)\]/g,
          (match, num) => {
            const source = newSources[parseInt(num) - 1];
            if (!source) return match;
            return ` [${parseInt(num) + offset}](${source.url})`;
          },
        );
        setMessages((prevMessages) => {
          const updatedMessages = [...prevMessages];
          updatedMessages[updatedMessages.length - 1] = {
            ...lastMessage,
            content: updatedContent,
          } as CoreMessage;
          return updatedMessages;
        });
        setSources([...sources(), ...newSources]);
        setLastSourceLinkNumber(lastSourceLinkNumber() + newSources.length);
      }

      // Handle markdown links in response and add to sources
      const currentMessage = messages()[messages().length - 1];
      const newLinks =
        (currentMessage.content as string).match(/\[(.*?)\]\((.*?)\)/g) || [];
      newLinks.forEach((link) => {
        const [text, url] = link.slice(1, -1).split("](");
        const existingSource = sources().find((source) => source.url === url);
        if (!existingSource) {
          setSources([...sources(), { url, title: text }]);
          setLastSourceLinkNumber(lastSourceLinkNumber() + 1);
        }
      });
      triggerChange(true);
    } catch (error) {
      const message = (error as any).message || "Unknown error";
      new Notice("Error generating response: " + message);
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

  const handleCancelRequest = () => {
    setIsProcessing(false);
    const request = currentRequest();
    if (!request) return;
    cancelChatResponse(request);

    const cancelMessage: CoreMessage = {
      role: "assistant",
      content: "*Request cancelled by user*",
    };

    setMessages((prevMessages) => [...prevMessages, cancelMessage]);
    triggerChange();
  };

  return (
    <div>
      <ChatHistory
        messages={messages}
        isProcessing={isProcessing} // Pass the isProcessing signal accessor for reactivity
        onCancelRequest={handleCancelRequest}
      />
      <Show when={sources().length > 0}>
        <SourceList sources={sources} />
      </Show>
      <ContextList
        app={app}
        contextItems={contextItems}
        setContextItems={setContextItems}
        onAddNote={handleLinkNote}
        onAddTag={handleAddTag}
      />
      <UserInput
        triggerChange={triggerChange}
        onSubmit={handleSendMessage}
        currentModel={model}
        updateModel={setModel}
        onLinkNote={handleLinkNote}
        onAddTag={handleAddTag}
      />
    </div>
  );
};
