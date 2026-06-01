import { Component, For } from "solid-js";

import type { MessagePart } from "@/session/types";

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
            return <ToolCallCard part={props.part} />;
        case "tool-result":
            return <ToolResultCard part={props.part} />;
        case "attachment":
            return null;
        default:
            return null;
    }
};
