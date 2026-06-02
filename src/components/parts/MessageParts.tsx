import { Component, For, Show, useContext } from "solid-js";

import { PluginContext } from "@/CoiChatApp";
import type { ApprovalDecision } from "@/agent/permission-broker";
import type { MessagePart } from "@/session/types";

import { ApprovalPrompt } from "@/components/parts/ApprovalPrompt";
import { EditNoteApprovalPrompt } from "@/components/parts/EditNoteApprovalPrompt";
import { ReasoningBlock } from "@/components/parts/ReasoningBlock";
import { TextPart } from "@/components/parts/TextPart";
import { ToolCallCard } from "@/components/parts/ToolCallCard";
import { ToolResultCard } from "@/components/parts/ToolResultCard";

export interface MessagePartsProps {
    parts: readonly MessagePart[];
}

/**
 * Renders an assistant message's parts in order. Routes each part to the
 * matching component (text → markdown, reasoning → collapsible block,
 * tool-call / tool-result → cards). Attachments are no-ops for now —
 * pairs with the deferred attachment-chip work.
 */
export const MessageParts: Component<MessagePartsProps> = (props) => {
    return (
        <For each={props.parts}>{(part) => <PartRouter part={part} />}</For>
    );
};

const PartRouter: Component<{ part: MessagePart }> = (props) => {
    switch (props.part.type) {
        case "text":
            return <TextPart text={props.part.text} />;
        case "reasoning":
            return <ReasoningBlock text={props.part.text} />;
        case "tool-call":
            return <ToolCallPart part={props.part} />;
        case "tool-result":
            return <ToolResultCard part={props.part} />;
        case "attachment":
            return null;
        default:
            return null;
    }
};

/**
 * Picks between the static tool-call card and the in-chat approval prompt
 * by reading the permission broker's pending list. When the broker has an
 * entry matching this part's toolCallId, the approval card replaces the
 * static card so the user can act on it without leaving the chat.
 */
const ToolCallPart: Component<{
    part: Extract<MessagePart, { type: "tool-call" }>;
}> = (props) => {
    const plugin = useContext(PluginContext);
    const pendingForCall = () => {
        const queue = plugin?.permissionBroker?.pending() ?? [];
        return queue.find(
            (p) => p.toolCallId === props.part.toolCallId,
        );
    };
    return (
        <Show
            when={pendingForCall()}
            fallback={<ToolCallCard part={props.part} />}
            keyed
        >
            {(request) => {
                const onDecide = (decision: ApprovalDecision) =>
                    plugin?.permissionBroker?.resolve(
                        request.toolCallId,
                        decision,
                    );
                if (request.toolName === "edit_note") {
                    return (
                        <EditNoteApprovalPrompt
                            request={request}
                            onDecide={onDecide}
                        />
                    );
                }
                return (
                    <ApprovalPrompt request={request} onDecide={onDecide} />
                );
            }}
        </Show>
    );
};
