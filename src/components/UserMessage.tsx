import { Component } from "solid-js";
import { CoreMessage } from "ai";

export interface UserMessageProps {
  message: CoreMessage;
}

export const UserMessage: Component<UserMessageProps> = ({ message }) => {
  return (
    <div class="coi-user-message">
      <p>{message.content as string}</p>
    </div>
  );
};
