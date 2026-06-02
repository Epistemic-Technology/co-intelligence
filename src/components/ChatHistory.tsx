import {
    Component,
    Accessor,
    createEffect,
    onMount,
    Show,
    For,
} from "solid-js";

import type { SessionMessage } from "@/session/types";

import { BotMessage } from "@/components/BotMessage";
import { UserMessage } from "@/components/UserMessage";
import { ProcessingIndicator } from "@/components/ProcessingIndicator";

export interface ChatHistoryProps {
    messages: Accessor<readonly SessionMessage[]>;
    isProcessing: Accessor<boolean>;
    currentStep?: Accessor<number>;
    maxSteps?: Accessor<number>;
    onCancelRequest?: () => void;
}

export const ChatHistory: Component<ChatHistoryProps> = (props) => {
    let chatContainerRef: HTMLDivElement | undefined;

    const scrollToBottom = () => {
        if (chatContainerRef) {
            chatContainerRef.scrollTop = chatContainerRef.scrollHeight;
        }
    };

    createEffect(() => {
        props.messages();
        props.isProcessing();
        window.setTimeout(scrollToBottom, 0);
    });

    onMount(scrollToBottom);

    return (
        <div class="coi-chat-history" ref={chatContainerRef}>
            <For each={props.messages() as SessionMessage[]}>
                {(message) =>
                    message.role === "assistant" ? (
                        <BotMessage message={message} />
                    ) : (
                        <UserMessage message={message} />
                    )
                }
            </For>
            <Show when={props.isProcessing()}>
                <ProcessingIndicator
                    currentStep={props.currentStep}
                    maxSteps={props.maxSteps}
                    onCancel={props.onCancelRequest}
                />
            </Show>
        </div>
    );
};
