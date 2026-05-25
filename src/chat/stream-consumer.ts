/**
 * Loose shape for an AI SDK `fullStream` chunk. We only narrow on `type`; the
 * remaining fields are read structurally.
 */
export interface ChatStreamChunk {
    type: string;
    [key: string]: unknown;
}

/**
 * Normalized event the chat controller cares about. Reasoning markers are
 * folded into the text channel as inline `<think>` / `</think>` tags so the
 * caller doesn't need to know about reasoning-specific chunk types.
 */
export type ChatStreamEvent =
    | { type: "text"; text: string }
    | { type: "error"; error: unknown };

/**
 * Translates an AI SDK fullStream into a flat sequence of {@link ChatStreamEvent}s.
 * Unknown chunk types are dropped. Errors are surfaced as events rather than
 * thrown — iteration-level failures still propagate via rejection.
 */
export async function* consumeChatStream(
    stream: AsyncIterable<ChatStreamChunk>,
): AsyncIterable<ChatStreamEvent> {
    for await (const chunk of stream) {
        switch (chunk.type) {
            case "error":
                yield { type: "error", error: chunk.error };
                break;
            case "reasoning-start":
                yield { type: "text", text: "<think>" };
                break;
            case "reasoning-end":
                yield { type: "text", text: "</think>" };
                break;
            case "text-delta":
            case "reasoning-delta":
                yield { type: "text", text: chunk.text as string };
                break;
            default:
                break;
        }
    }
}
