import {
    stepCountIs,
    streamText,
    type JSONValue,
    type LanguageModel,
    type ModelMessage,
    type StreamTextResult,
    type TextStreamPart,
    type ToolSet,
} from "ai";

import type { AgentEvent } from "@/agent/types";

type StreamTextParams = Parameters<typeof streamText>[0];

/**
 * Default per-call step budget. Picked low for Phase 1 because no first-party
 * tools exist yet — bumped in later phases as the tool surface grows.
 */
export const DEFAULT_MAX_STEPS = 10;

export interface AgentLoopParams {
    model: LanguageModel;
    messages: ModelMessage[];
    system?: string;
    tools?: ToolSet;
    maxSteps?: number;
    abortSignal?: AbortSignal;
    providerOptions?: Record<string, Record<string, JSONValue>>;
    headers?: Record<string, string>;
    onError?: (error: unknown) => void;
}

/**
 * What the agent loop hands back. `events` is the normalized stream the UI
 * iterates. `sources` and `rawResult` expose the underlying AI SDK promise
 * surfaces so callers can still pull `sources` (used by the source-processor)
 * without re-deriving them from events.
 */
export interface AgentEventStream {
    events: AsyncIterable<AgentEvent>;
    sources: StreamTextResult<ToolSet, never>["sources"];
    rawResult: StreamTextResult<ToolSet, never>;
}

/**
 * Wraps `streamText` and translates each AI SDK chunk into an {@link AgentEvent}.
 * Unknown chunk types are dropped silently — adding a new event type requires
 * touching this switch and the AgentEvent union, on purpose.
 *
 * `stopWhen: stepCountIs(maxSteps)` puts a hard ceiling on multi-step tool
 * loops; without it `streamText` defaults to a single step (no agent loop).
 */
export function runAgentLoop(params: AgentLoopParams): AgentEventStream {
    const {
        model,
        messages,
        system,
        tools,
        maxSteps = DEFAULT_MAX_STEPS,
        abortSignal,
        providerOptions,
        headers,
        onError,
    } = params;

    const callSettings: StreamTextParams = {
        model,
        messages,
        system,
        tools,
        stopWhen: stepCountIs(maxSteps),
        abortSignal,
        providerOptions,
        headers,
    };

    if (onError) {
        callSettings.onError = (event) => onError(event.error);
    }

    const result = streamText(callSettings);

    return {
        events: translate(result.fullStream),
        sources: result.sources,
        rawResult: result,
    };
}

/**
 * Translates the AI SDK `fullStream` into the normalized AgentEvent stream.
 * Exported for testing — call sites should use {@link runAgentLoop}.
 */
export async function* translate(
    fullStream: AsyncIterable<TextStreamPart<ToolSet>>,
): AsyncIterable<AgentEvent> {
    for await (const chunk of fullStream) {
        switch (chunk.type) {
            case "text-delta":
                yield { type: "text", text: chunk.text };
                break;
            case "reasoning-start":
                yield { type: "reasoning-start" };
                break;
            case "reasoning-delta":
                yield { type: "reasoning-delta", text: chunk.text };
                break;
            case "reasoning-end":
                yield { type: "reasoning-end" };
                break;
            case "tool-call":
                yield {
                    type: "tool-call",
                    toolCallId: chunk.toolCallId,
                    toolName: chunk.toolName,
                    input: chunk.input,
                };
                break;
            case "tool-input-delta":
                yield {
                    type: "tool-input-delta",
                    toolCallId: chunk.id,
                    delta: chunk.delta,
                };
                break;
            case "tool-result":
                yield {
                    type: "tool-result",
                    toolCallId: chunk.toolCallId,
                    toolName: chunk.toolName,
                    output: chunk.output,
                };
                break;
            case "tool-error":
                yield {
                    type: "tool-error",
                    toolCallId: chunk.toolCallId,
                    toolName: chunk.toolName,
                    error: chunk.error,
                };
                break;
            case "tool-approval-request":
                yield {
                    type: "approval-requested",
                    approvalId: chunk.approvalId,
                    toolCallId: chunk.toolCall.toolCallId,
                    toolName: chunk.toolCall.toolName,
                    input: chunk.toolCall.input,
                };
                break;
            case "finish-step":
                yield {
                    type: "finish-step",
                    finishReason: chunk.finishReason,
                };
                break;
            case "finish":
                yield { type: "finish", finishReason: chunk.finishReason };
                break;
            case "abort":
                yield { type: "finish", finishReason: "aborted" };
                break;
            case "error":
                yield { type: "error", error: chunk.error };
                break;
            default:
                break;
        }
    }
}
