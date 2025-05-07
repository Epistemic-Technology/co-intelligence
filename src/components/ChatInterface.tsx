import { Component, createSignal, useContext } from "solid-js";
import { CoreMessage } from "ai";

import { ModelRegistry, Model, ModelId } from "@/services/model-registry";
import {
  generateChatResponse,
  ChatRequest,
  generateChatTitle,
} from "@/services/model-service";
import { PluginContext, ChangeCallbackContext } from "@/CoiChatApp";
import { ChatHistory } from "@/components/ChatHistory";
import { UserInput } from "@/components/UserInput";

export interface ChatInterfaceProps {
  initialMessages: CoreMessage[];
}

export const ChatInterface = ({ initialMessages }: ChatInterfaceProps) => {
  const plugin = useContext(PluginContext);
  const onChange = useContext(ChangeCallbackContext);

  if (!plugin) {
    throw new Error("PluginContext is not available");
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

  const handleSendMessage = async (message: string) => {
    if (!message.trim()) {
      console.warn("Message is empty");
      return;
    }
    const newMessage: CoreMessage = { role: "user", content: message };
    setMessages([...messages(), newMessage]);

    const request: ChatRequest = {
      modelId: model().id,
      messages: messages(),
    };

    const assistantMessage: CoreMessage = {
      role: "assistant",
      content: "",
    };
    setMessages([...messages(), assistantMessage]);

    const responseStream = await generateChatResponse(request, registry);
    let accumulatedContent = "";

    for await (const chunk of responseStream) {
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
    const newTitle = await generateChatTitle(model().id, messages(), registry);
    if (onChange) {
      onChange(messages(), newTitle);
    }
  };

  return (
    <div>
      <ChatHistory messages={messages} />
      <UserInput
        onSubmit={handleSendMessage}
        currentModel={model}
        updateModel={setModel}
      />
    </div>
  );
};
