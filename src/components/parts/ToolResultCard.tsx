import { Component, Show } from "solid-js";

import type { MessagePart } from "@/session/types";
import { DiffView } from "@/components/parts/DiffView";

type ToolResultPart = Extract<MessagePart, { type: "tool-result" }>;

export interface ToolResultCardProps {
    part: ToolResultPart;
}

interface EditNoteSuccessOutput {
    path: string;
    replacements: number;
    diff: string;
}

/**
 * Collapsible card for a tool result. edit_note successes render the diff
 * via {@link DiffView} so the user sees what was actually written. Other
 * outputs fall back to verbatim strings or pretty-printed JSON; errors get
 * an `is-error` border + auto-open.
 */
export const ToolResultCard: Component<ToolResultCardProps> = (props) => {
    const isError = () => props.part.isError === true;
    const editDiff = () => detectEditNoteDiff(props.part);
    return (
        <details
            class={`coi-tool-card coi-tool-result ${
                isError() ? "is-error" : ""
            }`}
            open={isError()}
        >
            <summary class="coi-tool-card-summary">
                <span class="coi-tool-card-icon" aria-hidden="true">
                    {isError() ? "✕" : "←"}
                </span>
                <span class="coi-tool-card-name">{props.part.toolName}</span>
                <span class="coi-tool-card-status">
                    {isError() ? "error" : "result"}
                </span>
            </summary>
            <Show
                when={editDiff()}
                fallback={
                    <pre class="coi-tool-card-body">
                        {formatOutput(props.part.output)}
                    </pre>
                }
                keyed
            >
                {(diff) => <DiffView diff={diff} />}
            </Show>
        </details>
    );
};

function detectEditNoteDiff(part: ToolResultPart): string | null {
    if (part.isError) return null;
    if (part.toolName !== "edit_note") return null;
    const output = part.output as Partial<EditNoteSuccessOutput> | null;
    if (!output || typeof output !== "object") return null;
    if (typeof output.diff !== "string") return null;
    return output.diff;
}

function formatOutput(output: unknown): string {
    if (typeof output === "string") return output;
    if (output === null || output === undefined) return "";
    try {
        return JSON.stringify(output, null, 2);
    } catch {
        return String(output);
    }
}
