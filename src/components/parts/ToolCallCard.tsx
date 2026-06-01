import { Component, Show } from "solid-js";

import type { MessagePart } from "@/session/types";

type ToolCallPart = Extract<MessagePart, { type: "tool-call" }>;

export interface ToolCallCardProps {
    part: ToolCallPart;
}

/**
 * Collapsible card for an agent tool call. Shows the tool name, a status
 * pill, and the JSON arguments behind a `<details>` disclosure. Status text
 * follows the part lifecycle (`pending` → `running` → `success` / `error` /
 * `denied`) so the user can see what stage a call is in.
 */
export const ToolCallCard: Component<ToolCallCardProps> = (props) => {
    const argsJson = () => {
        try {
            return JSON.stringify(props.part.input, null, 2);
        } catch {
            return String(props.part.input);
        }
    };
    const statusLabel = () => statusLabels[props.part.status];
    return (
        <details
            class={`coi-tool-card coi-tool-call coi-tool-status-${props.part.status}`}
        >
            <summary class="coi-tool-card-summary">
                <span class="coi-tool-card-icon" aria-hidden="true">
                    →
                </span>
                <span class="coi-tool-card-name">{props.part.toolName}</span>
                <span class="coi-tool-card-status">{statusLabel()}</span>
            </summary>
            <Show when={hasArgs(props.part.input)}>
                <pre class="coi-tool-card-body">{argsJson()}</pre>
            </Show>
        </details>
    );
};

const statusLabels: Record<ToolCallPart["status"], string> = {
    pending: "pending",
    "awaiting-approval": "waiting for approval",
    running: "running…",
    success: "done",
    error: "error",
    denied: "denied",
};

function hasArgs(input: unknown): boolean {
    if (input === null || input === undefined) return false;
    if (typeof input !== "object") return true;
    return Object.keys(input as Record<string, unknown>).length > 0;
}
