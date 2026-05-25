import { describe, it, expect } from "vitest";
import {
    consumeChatStream,
    type ChatStreamEvent,
} from "@/chat/stream-consumer";
import type { AgentEvent } from "@/agent/types";

async function* fromArray<T>(items: T[]): AsyncIterable<T> {
    for (const item of items) yield item;
}

async function collect(
    stream: AsyncIterable<AgentEvent>,
): Promise<ChatStreamEvent[]> {
    const out: ChatStreamEvent[] = [];
    for await (const ev of consumeChatStream(stream)) out.push(ev);
    return out;
}

describe("consumeChatStream", () => {
    it("yields nothing for an empty stream", async () => {
        const events = await collect(fromArray([]));
        expect(events).toEqual([]);
    });

    it("forwards text events as text", async () => {
        const events = await collect(
            fromArray<AgentEvent>([
                { type: "text", text: "hello " },
                { type: "text", text: "world" },
            ]),
        );
        expect(events).toEqual([
            { type: "text", text: "hello " },
            { type: "text", text: "world" },
        ]);
    });

    it("folds reasoning events into the text channel with <think> markers", async () => {
        const events = await collect(
            fromArray<AgentEvent>([
                { type: "reasoning-start" },
                { type: "reasoning-delta", text: "step 1" },
                { type: "reasoning-end" },
                { type: "text", text: "answer" },
            ]),
        );
        expect(events).toEqual([
            { type: "text", text: "<think>" },
            { type: "text", text: "step 1" },
            { type: "text", text: "</think>" },
            { type: "text", text: "answer" },
        ]);
    });

    it("surfaces error events without halting", async () => {
        const events = await collect(
            fromArray<AgentEvent>([
                { type: "text", text: "before" },
                { type: "error", error: new Error("boom") },
                { type: "text", text: "after" },
            ]),
        );
        expect(events).toHaveLength(3);
        expect(events[0]).toEqual({ type: "text", text: "before" });
        expect(events[1].type).toBe("error");
        expect(
            ((events[1] as { error: Error }).error as Error).message,
        ).toBe("boom");
        expect(events[2]).toEqual({ type: "text", text: "after" });
    });

    it("forwards tool / finish events unchanged for the agentic UI", async () => {
        const events = await collect(
            fromArray<AgentEvent>([
                {
                    type: "tool-call",
                    toolCallId: "c1",
                    toolName: "read_note",
                    input: { path: "a.md" },
                },
                {
                    type: "tool-result",
                    toolCallId: "c1",
                    toolName: "read_note",
                    output: "ok",
                },
                { type: "finish-step", finishReason: "tool-calls" },
                { type: "finish", finishReason: "stop" },
            ]),
        );
        expect(events.map((e) => e.type)).toEqual([
            "tool-call",
            "tool-result",
            "finish-step",
            "finish",
        ]);
    });

    it("propagates iteration errors via promise rejection", async () => {
        async function* failing(): AsyncIterable<AgentEvent> {
            yield { type: "text", text: "first" };
            throw new Error("network drop");
        }
        const iter = consumeChatStream(failing());
        const first = await iter[Symbol.asyncIterator]().next();
        expect(first).toEqual({
            value: { type: "text", text: "first" },
            done: false,
        });
        await expect(
            iter[Symbol.asyncIterator]().next(),
        ).rejects.toThrow("network drop");
    });
});
