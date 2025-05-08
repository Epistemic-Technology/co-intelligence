import { Component, JSX, useContext } from "solid-js";
import { AppContext, PluginContext } from "@/CoiChatApp";
import { className } from "solid-js/web";

export interface MessageContainerProps {
  children: JSX.Element;
  class?: string;
}

export const MessageContainer: Component<MessageContainerProps> = (props) => {
  const app = useContext(AppContext);
  const plugin = useContext(PluginContext);

  const handleClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement;

    // Check if the clicked element is an anchor
    if (target.tagName === "A") {
      event.preventDefault();

      const anchor = target as HTMLAnchorElement;
      const href = anchor.getAttribute("href");

      if (href && app) {
        if (
          href.startsWith("#") ||
          href.startsWith("obsidian://") ||
          anchor.classList.contains("internal-link")
        ) {
          // Use Obsidian's API to handle internal links
          const newLeaf = event.ctrlKey || event.metaKey;
          app.workspace.openLinkText(href, "", newLeaf);
        } else {
          // For external links, open in the default browser
          window.open(href, "_blank");
        }
      }
    }
  };

  return (
    <div
      class={`coi-message-container ${props.class || ""}`}
      onClick={handleClick}
    >
      {props.children}
    </div>
  );
};
