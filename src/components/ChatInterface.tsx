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
}

export const ChatInterface = ({
  initialMessages,
  initialLinkedNotes = [],
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
  if (!currentModel) {
    return (
      <div class="coi-error">
        No available model found. Please configure model providers in the
        settings.
      </div>
    );
  }

  const [model, setModel] = createSignal<Model>(currentModel);
  const [messages, setMessages] = createSignal<CoreMessage[]>(initialMessages);
  const [linkedNotes, setLinkedNotes] =
    createSignal<TFile[]>(initialLinkedNotes);
  const [sources, setSources] = createSignal<Source[]>([]);

  const app = useContext(AppContext);

  const handleLinkNote = (file: TFile) => {
    if (!linkedNotes().some((note) => note.path === file.path)) {
      setLinkedNotes([...linkedNotes(), file]);
    }
  };

  const handleRemoveLink = (file: TFile) => {
    setLinkedNotes(linkedNotes().filter((note) => note.path !== file.path));
  };

  const handleSendMessage = async (message: string) => {
    if (!message.trim()) {
      console.warn("Message is empty");
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
      modelId: model().id,
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
    setSources(await responseStream.sources);
    const newTitle = await generateChatTitle(model().id, messages(), registry);
    if (onChange) {
      onChange(messages(), newTitle, linkedNotes());
    }
  };

  return (
    <div>
      <ChatHistory messages={messages} />
      {sources().length > 0 && <SourceList sources={sources()} />}
      {linkedNotes().length > 0 && (
        <LinkedNotes
          notes={linkedNotes()}
          handleRemoveLink={handleRemoveLink}
        />
      )}
      <UserInput
        onSubmit={handleSendMessage}
        currentModel={model}
        updateModel={setModel}
        onLinkNote={handleLinkNote}
      />
    </div>
  );
};
