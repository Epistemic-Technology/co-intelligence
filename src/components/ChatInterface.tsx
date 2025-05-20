import { createSignal, useContext } from "solid-js";
import { CoreMessage } from "ai";
import { TFile } from "obsidian";

import { ModelRegistry } from "@/services/model-registry";
import {
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
import { PluginContext, AppContext } from "@/CoiChatApp";
import { ChatHistory } from "@/components/ChatHistory";
import { UserInput } from "@/components/UserInput";
import { ContextList } from "@/components/ContextList";
import { SourceList } from "@/components/SourceList";
import { getContext } from "@/utils/model-context";
import { HandleChatChangeProps } from "@/ChatView";

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

  const app = useContext(AppContext);

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
  };

  const handleSendMessage = async (message: string) => {
    if (!message.trim()) {
      console.warn("Message is empty");
      return;
    }
    if (!model()) {
      console.warn("No model selected");
      return;
    }
    if (!app) {
      console.error("No app instance");
      return;
    }
    const newMessage: CoreMessage = { role: "user", content: message };
    setMessages([...messages(), newMessage]);

    const parsedContext = await getContext(contextItems(), app);

    const request: ChatRequest = {
      modelId: (model() as Model).id,
      messages: messages(),
      context: parsedContext,
    };

    const assistantMessage: CoreMessage = {
      role: "assistant",
      content: "",
    };
    setMessages([...messages(), assistantMessage]);

    const responseStream = await generateChatResponse(request, registry);
    let accumulatedContent = "";

    for await (const chunk of responseStream.textStream) {
      accumulatedContent += chunk;
      const responseMessage: CoreMessage = {
        role: "assistant",
        content: accumulatedContent,
      };
      setMessages((prevMessages) => {
        const updatedMessages = [...prevMessages];
        updatedMessages[updatedMessages.length - 1] = responseMessage;
        return updatedMessages;
      });
    }
    const newSources = await responseStream.sources;
    if (newSources.length > 0) {
      const lastMessage = messages()[messages().length - 1];
      // Replace source reference numbers [n] with [n+offset]
      const offset = lastSourceLinkNumber();
      lastMessage.content = (lastMessage.content as string).replace(
        /\[(\d+)\]/g,
        (match, num) => {
          const source = newSources[parseInt(num) - 1];
          if (!source) return match;
          return ` [${parseInt(num) + offset}](${source.url})`;
        },
      );
      setMessages((prevMessages) => {
        const updatedMessages = [...prevMessages];
        updatedMessages[updatedMessages.length - 1] = lastMessage;
        return updatedMessages;
      });
      setSources([...sources(), ...newSources]);
      setLastSourceLinkNumber(lastSourceLinkNumber() + newSources.length);
    }
    const newTitle = await generateChatTitle(
      model()?.id || null,
      messages(),
      registry,
    );
    if (onChange) {
      onChange({
        newMessages: messages(),
        newTitle,
        contextItems: contextItems(),
        sources: sources(),
      });
    }
  };

  return (
    <div>
      <ChatHistory messages={messages} />
      {sources().length > 0 && <SourceList sources={sources} />}
      <ContextList contextItems={contextItems} />
      <UserInput
        onSubmit={handleSendMessage}
        currentModel={model}
        updateModel={setModel}
        onLinkNote={handleLinkNote}
        onAddTag={handleAddTag}
      />
    </div>
  );
};
