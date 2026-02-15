import { Component, useContext, Show } from "solid-js";
import { ModelChatMessage } from "@/types";

import { ChatMessage } from "@/components/ChatMessage";
import { MarkdownView } from "@/components/MarkdownView";
import { FileContext } from "@/CoiChatApp";

export interface BotMessageProps {
  message: ModelChatMessage;
}

export const BotMessage: Component<BotMessageProps> = ({
  message,
}: BotMessageProps) => {
  const file = useContext(FileContext);
  const filePath = file?.path || "";
  const content = (message.content as string) ?? "";
  // Perplexity models use <think> tags to indicate the reasoning section.
  // OpenAI models use chunk types instead. These are translated into <think>
  // tags by handleSendMessage in ChatInterface.tsx
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
  } as ModelChatMessage;

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
