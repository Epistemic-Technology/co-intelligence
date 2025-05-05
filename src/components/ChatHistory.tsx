import { Component, Accessor } from "solid-js";
import { CoreMessage } from "ai";

import { BotMessage } from "@/components/BotMessage";
import { UserMessage } from "@/components/UserMessage";

export interface ChatHistoryProps {
  messages: Accessor<CoreMessage[]>;
}

export const ChatHistory: Component<ChatHistoryProps> = ({ messages }) => {
  return (
    <div class="coi-chat-history">
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
