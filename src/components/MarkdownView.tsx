import { MarkdownRenderer, Notice } from "obsidian";
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
  if (!app) {
    new Notice(
      "Error: AppContext is not available while creating MarkdownView",
    );
    console.error("AppContext is not available");
    return null;
  }
  if (!plugin) {
    new Notice(
      "Error: PluginContext is not available while creating MarkdownView",
    );
    console.error("PluginContext is not available");
    return null;
  }

  const renderMarkdown = async () => {
    if (containerRef && app && plugin) {
      while (containerRef.firstChild) {
        containerRef.removeChild(containerRef.firstChild);
      }

      try {
        await MarkdownRenderer.render(
          app,
          markdown,
          containerRef,
          sourcePath,
          plugin,
        );
      } catch (error) {
        new Notice("Error: Failed to render markdown");
        console.error("Failed to render markdown:", error);
        containerRef.textContent = "Error rendering markdown";
      }
    }
  };

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
