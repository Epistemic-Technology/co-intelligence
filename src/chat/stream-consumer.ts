import type { AgentEvent } from "@/agent/types";

/**
 * Reducer-style event the chat controller cares about. Reasoning markers are
 * folded into the text channel as inline `<think>` / `</think>` tags so the
 * caller doesn't need a separate reasoning code path. Tool / approval events
 * pass through unchanged for the agentic UI in Phase 5.
 */
export type ChatStreamEvent =
    | { type: "text"; text: string }
    | { type: "error"; error: unknown }
    | Exclude<
          AgentEvent,
          | { type: "text" }
          | { type: "reasoning-start" }
          | { type: "reasoning-delta"; text: string }
          | { type: "reasoning-end" }
          | { type: "error"; error: unknown }
      >;

/**
 * Translates the {@link AgentEvent} stream into the flat shape the chat
 * controller iterates. Reasoning-start/end become inline `<think>` markers
 * and reasoning-delta is merged into the text channel; everything else is
 * forwarded as-is.
 */
export async function* consumeChatStream(
    stream: AsyncIterable<AgentEvent>,
): AsyncIterable<ChatStreamEvent> {
    for await (const event of stream) {
        switch (event.type) {
            case "text":
                yield { type: "text", text: event.text };
                break;
            case "reasoning-start":
                yield { type: "text", text: "<think>" };
                break;
            case "reasoning-delta":
                yield { type: "text", text: event.text };
                break;
            case "reasoning-end":
                yield { type: "text", text: "</think>" };
                break;
            case "error":
                yield { type: "error", error: event.error };
                break;
            default:
                yield event;
                break;
        }
    }
}
