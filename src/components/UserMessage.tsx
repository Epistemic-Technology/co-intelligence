import { Component } from "solid-js";
import { ModelChatMessage } from "@/types";

import { ChatMessage } from "./ChatMessage";

export interface UserMessageProps {
  message: ModelChatMessage;
}

export const UserMessage: Component<UserMessageProps> = ({ message }) => {
  return <ChatMessage message={message} className="coi-user-message" />;
};
