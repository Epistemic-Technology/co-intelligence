import { Component, useContext, Show } from "solid-js";
import { CoreMessage } from "ai";

import { ChatMessage } from "@/components/ChatMessage";
import { MarkdownView } from "@/components/MarkdownView";
import { AppContext, FileContext, PluginContext } from "@/CoiChatApp";

export interface BotMessageProps {
  message: CoreMessage;
}

export const BotMessage: Component<BotMessageProps> = ({
  message,
}: BotMessageProps) => {
  const file = useContext(FileContext);
  const filePath = file?.path || "";
  const content = message.content as string;
  const openTagIndex = content.indexOf("<think>");
  const closeTagIndex = content.indexOf("</think>", openTagIndex);

  let thoughts = "";
  let mainContent = "";
  if (openTagIndex > -1 && closeTagIndex > -1) {
    thoughts = content.substring(openTagIndex + 7, closeTagIndex);
    mainContent = content.substring(closeTagIndex + 8);
  } else if (openTagIndex > -1) {
    thoughts = content.substring(openTagIndex + 7);
    mainContent = "";
  } else {
    thoughts = "";
    mainContent = content;
  }

  const newMessage = {
    ...message,
    content: mainContent,
  } as CoreMessage;

  return (
    <div class="coi-bot-message-container">
      <Show when={thoughts.length > 0}>
        <details
          class="coi-thinking-details"
          open={openTagIndex > -1 && closeTagIndex === -1}
        >
          <summary class="coi-thinking-summary">Thinking...</summary>
          <div class="coi-thinking-section">
            <MarkdownView markdown={thoughts} sourcePath={filePath} />
          </div>
        </details>
      </Show>
      <ChatMessage message={newMessage} className="coi-bot-message" />
    </div>
  );
};
