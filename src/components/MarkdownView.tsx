import { MarkdownRenderer, MarkdownRenderChild, Notice } from "obsidian";
import { Component, createEffect, onCleanup, useContext } from "solid-js";
import { AppContext, PluginContext } from "@/CoiChatApp";

interface MarkdownViewProps {
    markdown: string;
    sourcePath?: string;
}

/**
 * Wraps Obsidian's `MarkdownRenderer.render` in a Solid component. The
 * createEffect reads `props.markdown` directly so streamed assistant text
 * updates fire a re-render — destructuring `markdown` in the function
 * signature would freeze it at first-render value and the message would
 * appear stuck at its first chunk until the chat reloaded from disk.
 */
export const MarkdownView: Component<MarkdownViewProps> = (props) => {
    let containerRef: HTMLDivElement | undefined;
    let currentRenderChild: MarkdownRenderChild | undefined;
    const app = useContext(AppContext);
    const plugin = useContext(PluginContext);
    if (!app) {
        new Notice("Error: app context is not available");
        console.error("AppContext is not available");
        return null;
    }
    if (!plugin) {
        new Notice("Error: plugin context is not available");
        console.error("PluginContext is not available");
        return null;
    }

    const renderMarkdown = async (
        markdown: string,
        sourcePath: string,
    ): Promise<void> => {
        if (!containerRef) return;
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
            new Notice("Error: failed to render Markdown");
            console.error("Failed to render Markdown:", error);
            containerRef.textContent = "Error rendering Markdown";
        }
    };

    createEffect(() => {
        const markdown = props.markdown;
        const sourcePath = props.sourcePath ?? "";
        if (!markdown) return;
        void renderMarkdown(markdown, sourcePath);
    });

    onCleanup(() => {
        if (currentRenderChild) {
            currentRenderChild.unload();
        }
    });

    return (
        <div class="markdown-rendered" ref={(el) => (containerRef = el)} />
    );
};
