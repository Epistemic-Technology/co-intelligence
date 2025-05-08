import { Component, useContext } from "solid-js";
import { CoreMessage } from "ai";

import { MarkdownView } from "@/components/MarkdownView";
import { MessageContainer } from "@/components/MessageContainer";
import { FileContext } from "@/CoiChatApp";

export interface BotMessageProps {
  message: CoreMessage;
}

export const BotMessage: Component<BotMessageProps> = ({ message }) => {
  const file = useContext(FileContext);
  const filePath = file?.path ?? "";
  return (
    <MessageContainer class="coi-bot-message">
      <MarkdownView
        markdown={message.content as string}
        sourcePath={filePath}
      />
    </MessageContainer>
  );
};
