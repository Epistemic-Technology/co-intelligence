import { Component, Accessor, createEffect, onMount } from "solid-js";
import { CoreMessage } from "ai";

import { BotMessage } from "@/components/BotMessage";
import { UserMessage } from "@/components/UserMessage";

export interface ChatHistoryProps {
  messages: Accessor<CoreMessage[]>;
}

export const ChatHistory: Component<ChatHistoryProps> = ({ messages }) => {
  let chatContainerRef: HTMLDivElement | undefined;

  const scrollToBottom = () => {
    if (chatContainerRef) {
      chatContainerRef.scrollTop = chatContainerRef.scrollHeight;
    }
  };

  // Scroll to bottom whenever messages change
  createEffect(() => {
    messages();
    setTimeout(scrollToBottom, 0);
  });

  onMount(scrollToBottom);

  return (
    <div class="coi-chat-history" ref={chatContainerRef}>
      {messages().map((message) => {
        if (message.role === "assistant") {
          return <BotMessage message={message} />;
        } else {
          return <UserMessage message={message} />;
        }
      })}
    </div>
  );
};
