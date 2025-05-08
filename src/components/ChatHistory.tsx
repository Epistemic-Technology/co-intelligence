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
    // Access messages to create dependency
    messages();
    // Use setTimeout to ensure DOM has updated before scrolling
    setTimeout(scrollToBottom, 0);
  });

  // Initial scroll on mount
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
