import { Component, useContext } from "solid-js";
import { ModelChatMessage } from "@/types";

import { MarkdownView } from "@/components/MarkdownView";
import { FileContext, AppContext } from "@/CoiChatApp";

export interface ModelChatMessageProps {
  message: ModelChatMessage;
  className?: string;
}

export const ChatMessage: Component<ModelChatMessageProps> = ({
  message,
  className,
}) => {
  const file = useContext(FileContext);
  const filePath = file?.path ?? "";
  const app = useContext(AppContext);

  const handleClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement;

    if (target.tagName === "A") {
      event.preventDefault();

      const anchor = target as HTMLAnchorElement;
      const href = anchor.getAttribute("href");

      if (href && app) {
        if (href.startsWith("#")) {
          const newHref = `obsidian://search?query=${encodeURIComponent(`#${href.slice(1)}`)}`;
          window.open(newHref);
        } else if (anchor.classList.contains("internal-link")) {
          const newLeaf = event.ctrlKey || event.metaKey;
          void app.workspace.openLinkText(href, "", newLeaf);
        } else {
          window.open(href, "_blank");
        }
      }
    }
  };
  return (
    <div onClick={handleClick} class={className}>
      <MarkdownView
        markdown={(message.content as string) || ""}
        sourcePath={filePath}
      />
    </div>
  );
};
