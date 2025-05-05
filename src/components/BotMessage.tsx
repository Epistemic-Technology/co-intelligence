import { Component } from "solid-js";
import { CoreMessage } from "ai";

import { MarkdownView } from "@/components/MarkdownView";

export interface BotMessageProps {
  message: CoreMessage;
}

export const BotMessage: Component<BotMessageProps> = ({ message }) => {
  return (
    <div class="coi-bot-message">
      <MarkdownView markdown={message.content as string} />
    </div>
  );
};
