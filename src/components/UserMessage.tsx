import { Component, Accessor } from "solid-js";
import { CoreMessage } from "ai";

import { ChatMessage } from "./ChatMessage";

export interface UserMessageProps {
  message: CoreMessage;
}

export const UserMessage: Component<UserMessageProps> = ({ message }) => {
  return <ChatMessage message={message} className="coi-user-message" />;
};
