import { Component } from "solid-js";
import { CoreMessage } from "ai";

import { ChatMessage } from "@/components/ChatMessage";

export interface BotMessageProps {
  message: CoreMessage;
}

export const BotMessage: Component<BotMessageProps> = ({ message }) => {
  return <ChatMessage message={message} className="coi-bot-message" />;
};
