import { createSignal, useContext } from "solid-js";
import { CoreMessage } from "ai";
import { TFile } from "obsidian";

import { ModelRegistry, Model, ModelId } from "@/services/model-registry";
import {
  generateChatResponse,
  ContextNote,
  ChatRequest,
  generateChatTitle,
  Source,
} from "@/services/model-service";
import { PluginContext, ChangeCallbackContext, AppContext } from "@/CoiChatApp";
import { ChatHistory } from "@/components/ChatHistory";
import { UserInput } from "@/components/UserInput";
import { LinkedNotes } from "@/components/LinkedNotes";
import { SourceList } from "@/components/SourceList";

export interface ChatInterfaceProps {
  initialMessages: CoreMessage[];
  initialLinkedNotes?: TFile[];
  initialSources?: Source[];
}

export const ChatInterface = ({
  initialMessages,
  initialLinkedNotes = [],
  initialSources = [],
}: ChatInterfaceProps) => {
  const plugin = useContext(PluginContext);
  const onChange = useContext(ChangeCallbackContext);

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
  const [linkedNotes, setLinkedNotes] =
    createSignal<TFile[]>(initialLinkedNotes);
  const [sources, setSources] = createSignal<Source[]>(initialSources);
  const [lastSourceLinkNumber, setLastSourceLinkNumber] = createSignal<number>(
    initialSources.length,
  );

  const app = useContext(AppContext);

  const handleLinkNote = (file: TFile) => {
    if (!linkedNotes().some((note) => note.path === file.path)) {
      setLinkedNotes([...linkedNotes(), file]);
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
    const newMessage: CoreMessage = { role: "user", content: message };
    setMessages([...messages(), newMessage]);

    const contextNotes = await Promise.all(
      linkedNotes().map(async (file) => {
        try {
          const content = (await app?.vault.cachedRead(file)) || "";
          return {
            title: file.basename,
            content,
          };
        } catch (error) {
          console.error(`Error reading linked note ${file.path}:`, error);
          return null;
        }
      }),
    );

    const validContextNotes = contextNotes.filter((note) => note !== null);

    const request: ChatRequest = {
      modelId: (model() as Model).id,
      messages: messages(),
      contextNotes: validContextNotes,
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
      onChange(messages(), newTitle, linkedNotes(), sources());
    }
  };

  return (
    <div>
      <ChatHistory messages={messages} />
      {sources().length > 0 && <SourceList sources={sources} />}
      {linkedNotes().length > 0 && <LinkedNotes notes={linkedNotes()} />}
      <UserInput
        onSubmit={handleSendMessage}
        currentModel={model}
        updateModel={setModel}
        onLinkNote={handleLinkNote}
      />
    </div>
  );
};
