import {
  Component,
  Accessor,
  createEffect,
  onMount,
  Show,
  For,
} from "solid-js";
import { ModelChatMessage } from "@/types";

import { BotMessage } from "@/components/BotMessage";
import { UserMessage } from "@/components/UserMessage";
import { ProcessingIndicator } from "@/components/ProcessingIndicator";

export interface ChatHistoryProps {
  messages: Accessor<ModelChatMessage[]>;
  isProcessing: Accessor<boolean>;
  onCancelRequest?: () => void;
}

export const ChatHistory: Component<ChatHistoryProps> = ({
  messages,
  isProcessing,
  onCancelRequest,
}) => {
  let chatContainerRef: HTMLDivElement | undefined;

  const scrollToBottom = () => {
    if (chatContainerRef) {
      chatContainerRef.scrollTop = chatContainerRef.scrollHeight;
    }
  };

  // Scroll to bottom whenever messages change or processing state changes
  createEffect(() => {
    // Track both messages changes and isProcessing state
    messages();
    // Track the isProcessing signal
    isProcessing();
    setTimeout(scrollToBottom, 0);
  });

  onMount(scrollToBottom);

  return (
    <div class="coi-chat-history" ref={chatContainerRef}>
      <For each={messages()}>
        {(message) =>
          message.role === "assistant" ? (
            <BotMessage message={message} />
          ) : (
            <UserMessage message={message} />
          )
        }
      </For>
      <Show when={isProcessing()}>
        <ProcessingIndicator onCancel={onCancelRequest} />
      </Show>{" "}
    </div>
  );
};
