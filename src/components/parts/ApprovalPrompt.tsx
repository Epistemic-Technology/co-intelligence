import { Component, Show } from "solid-js";

import type {
    ApprovalDecision,
    PendingApproval,
} from "@/agent/permission-broker";

export interface ApprovalPromptProps {
    request: PendingApproval;
    onDecide: (decision: ApprovalDecision) => void;
}

/**
 * In-chat approval card. Renders inline in place of the {@link ToolCallCard}
 * while the permission broker holds a pending approval for the given tool
 * call. Clicking Allow / Deny / Always invokes the broker's resolve handler
 * via `onDecide`; the parts router then swaps back to the regular tool-call
 * card on the next render.
 */
export const ApprovalPrompt: Component<ApprovalPromptProps> = (props) => {
    const argsJson = () => {
        try {
            return JSON.stringify(props.request.input, null, 2);
        } catch {
            return String(props.request.input);
        }
    };
    return (
        <div class="coi-approval-prompt">
            <div class="coi-approval-prompt-header">
                <span class="coi-approval-prompt-icon" aria-hidden="true">
                    ?
                </span>
                <span class="coi-approval-prompt-title">
                    Approve <code>{props.request.toolName}</code>?
                </span>
            </div>
            <Show when={hasArgs(props.request.input)}>
                <pre class="coi-approval-prompt-args">{argsJson()}</pre>
            </Show>
            <div class="coi-approval-prompt-buttons">
                <button
                    type="button"
                    class="coi-approval-button coi-approval-deny"
                    onClick={() => props.onDecide("deny")}
                >
                    Deny
                </button>
                <button
                    type="button"
                    class="coi-approval-button coi-approval-allow mod-cta"
                    onClick={() => props.onDecide("allow")}
                >
                    Allow
                </button>
                <button
                    type="button"
                    class="coi-approval-button coi-approval-always"
                    onClick={() => props.onDecide("always")}
                >
                    Always allow
                </button>
            </div>
        </div>
    );
};

function hasArgs(input: unknown): boolean {
    if (input === null || input === undefined) return false;
    if (typeof input !== "object") return true;
    return Object.keys(input as Record<string, unknown>).length > 0;
}
