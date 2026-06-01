import { Component } from "solid-js";

import type { SessionMessage } from "@/session/types";
import { MessageParts } from "@/components/parts/MessageParts";
import { useLinkClicks } from "@/components/parts/useLinkClicks";

export interface UserMessageProps {
    message: SessionMessage;
}

/**
 * User message — typically just text, but it routes through MessageParts so
 * `[[wikilinks]]` and `#tags` render the same way they do in the assistant's
 * replies. Synthetic user messages (from direct tool invocations via slash
 * commands) flow through here too.
 */
export const UserMessage: Component<UserMessageProps> = (props) => {
    const onClick = useLinkClicks();
    return (
        <div class="coi-user-message" onClick={onClick}>
            <MessageParts parts={props.message.parts} />
        </div>
    );
};
