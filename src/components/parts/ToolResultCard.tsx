import { Component } from "solid-js";

import type { MessagePart } from "@/session/types";

type ToolResultPart = Extract<MessagePart, { type: "tool-result" }>;

export interface ToolResultCardProps {
    part: ToolResultPart;
}

/**
 * Collapsible card for a tool result. Strings are shown verbatim; other
 * outputs get pretty-printed as JSON. Error results get an `is-error` class
 * for distinct styling so the user can spot failures at a glance.
 */
export const ToolResultCard: Component<ToolResultCardProps> = (props) => {
    const isError = () => props.part.isError === true;
    const body = () => formatOutput(props.part.output);
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
            <pre class="coi-tool-card-body">{body()}</pre>
        </details>
    );
};

function formatOutput(output: unknown): string {
    if (typeof output === "string") return output;
    if (output === null || output === undefined) return "";
    try {
        return JSON.stringify(output, null, 2);
    } catch {
        return String(output);
    }
}
