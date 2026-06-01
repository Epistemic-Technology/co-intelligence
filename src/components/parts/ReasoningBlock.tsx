import { Component, useContext } from "solid-js";

import { FileContext } from "@/CoiChatApp";
import { MarkdownView } from "@/components/MarkdownView";

export interface ReasoningBlockProps {
    text: string;
    /**
     * When true, the disclosure is rendered open — used while the model is
     * still streaming the reasoning so the user can watch it land.
     */
    open?: boolean;
}

/**
 * Collapsible reasoning section. Replaces the `<think>` block rendering that
 * used to live in BotMessage. The body is rendered through MarkdownView so
 * formatting in the model's reasoning still resolves.
 */
export const ReasoningBlock: Component<ReasoningBlockProps> = (props) => {
    const file = useContext(FileContext);
    const filePath = () => file?.path ?? "";
    return (
        <details class="coi-thinking-details" open={props.open ?? false}>
            <summary class="coi-thinking-summary">Thinking…</summary>
            <div class="coi-thinking-section">
                <MarkdownView
                    markdown={props.text}
                    sourcePath={filePath()}
                />
            </div>
        </details>
    );
};
