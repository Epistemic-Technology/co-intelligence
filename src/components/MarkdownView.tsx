import { MarkdownRenderer, App, Component } from "obsidian";
import { createEffect, onMount, useContext } from "solid-js";
import { AppContext, PluginContext } from "@/CoiChatApp";

interface MarkdownViewProps {
  markdown: string;
  sourcePath?: string;
}

export const MarkdownView = ({
  markdown,
  sourcePath = "",
}: MarkdownViewProps) => {
  let containerRef: HTMLDivElement | undefined;
  const app = useContext(AppContext);
  const plugin = useContext(PluginContext);
  const renderMarkdown = async () => {
    if (containerRef && app && plugin) {
      // Clear any existing content
      containerRef.innerHTML = "";

      try {
        // Use the static render method to convert markdown to HTML
        await MarkdownRenderer.render(
          app,
          markdown,
          containerRef,
          sourcePath,
          plugin as unknown as Component,
        );
      } catch (error) {
        console.error("Failed to render markdown:", error);
        containerRef.textContent = "Error rendering markdown";
      }
    }
  };

  // Re-render when markdown content changes
  createEffect(() => {
    if (markdown) {
      renderMarkdown();
    }
  });

  onMount(() => {
    renderMarkdown();
  });

  return <div class="markdown-rendered" ref={(el) => (containerRef = el)} />;
};
