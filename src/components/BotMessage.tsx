import { Component } from "solid-js";

import type { SessionMessage } from "@/session/types";
import { MessageParts } from "@/components/parts/MessageParts";
import { useLinkClicks } from "@/components/parts/useLinkClicks";

export interface BotMessageProps {
    message: SessionMessage;
}

/**
 * Assistant message — renders each of the message's structured parts via
 * the parts router so tool calls, results, and reasoning all surface as
 * their own affordances instead of being smushed into a single text blob.
 */
export const BotMessage: Component<BotMessageProps> = (props) => {
    const onClick = useLinkClicks();
    return (
        <div class="coi-bot-message" onClick={onClick}>
            <MessageParts parts={props.message.parts} />
        </div>
    );
};
