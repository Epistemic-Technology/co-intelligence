import { MarkdownRenderer, MarkdownRenderChild, Notice } from "obsidian";
import { createEffect, onCleanup, onMount, useContext } from "solid-js";
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
  let currentRenderChild: MarkdownRenderChild | undefined;
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
      if (currentRenderChild) {
        currentRenderChild.unload();
      }

      while (containerRef.firstChild) {
        containerRef.removeChild(containerRef.firstChild);
      }

      try {
        currentRenderChild = new MarkdownRenderChild(containerRef);
        await MarkdownRenderer.render(
          app,
          markdown,
          containerRef,
          sourcePath,
          currentRenderChild,
        );
      } catch (error) {
        new Notice("Error: failed to render markdown");
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

  onCleanup(() => {
    if (currentRenderChild) {
      currentRenderChild.unload();
    }
  });

  return <div class="markdown-rendered" ref={(el) => (containerRef = el)} />;
};
