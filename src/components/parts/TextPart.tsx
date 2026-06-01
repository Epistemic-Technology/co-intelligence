import { Component, Show, useContext } from "solid-js";

import { FileContext } from "@/CoiChatApp";
import { MarkdownView } from "@/components/MarkdownView";
import { ReasoningBlock } from "@/components/parts/ReasoningBlock";

export interface TextPartProps {
    text: string;
}

const THINK_OPEN = "<think>";
const THINK_CLOSE = "</think>";

interface Split {
    /** Reasoning text inside the first <think> block, if any. */
    reasoning: string;
    /** Whether the reasoning block is still open (`<think>` with no matching close). */
    reasoningOpen: boolean;
    /** Markdown body after the reasoning block (or the whole text if no marker). */
    body: string;
}

export function splitThinkBlock(text: string): Split {
    const openIdx = text.indexOf(THINK_OPEN);
    if (openIdx === -1) {
        return { reasoning: "", reasoningOpen: false, body: text };
    }
    const closeIdx = text.indexOf(THINK_CLOSE, openIdx + THINK_OPEN.length);
    if (closeIdx === -1) {
        return {
            reasoning: text.slice(openIdx + THINK_OPEN.length),
            reasoningOpen: true,
            body: text.slice(0, openIdx),
        };
    }
    const reasoning = text.slice(openIdx + THINK_OPEN.length, closeIdx);
    const body =
        text.slice(0, openIdx) + text.slice(closeIdx + THINK_CLOSE.length);
    return { reasoning, reasoningOpen: false, body };
}

/**
 * Renders a `text` message part as markdown. Streamed text from Perplexity and
 * OpenAI carries inline `<think>` markers (translated by stream-consumer); we
 * split those out into a {@link ReasoningBlock} above the body so the markdown
 * renderer doesn't see the literal tags.
 */
export const TextPart: Component<TextPartProps> = (props) => {
    const file = useContext(FileContext);
    const filePath = () => file?.path ?? "";
    const split = () => splitThinkBlock(props.text);
    return (
        <>
            <Show when={split().reasoning.length > 0}>
                <ReasoningBlock
                    text={split().reasoning}
                    open={split().reasoningOpen}
                />
            </Show>
            <Show when={split().body.length > 0}>
                <MarkdownView
                    markdown={split().body}
                    sourcePath={filePath()}
                />
            </Show>
        </>
    );
};
