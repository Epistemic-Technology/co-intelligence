import { describe, it, expect } from "vitest";
import {
    consumeChatStream,
    type ChatStreamChunk,
    type ChatStreamEvent,
} from "@/chat/stream-consumer";

async function* fromArray<T>(items: T[]): AsyncIterable<T> {
    for (const item of items) yield item;
}

async function collect(
    stream: AsyncIterable<ChatStreamChunk>,
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

    it("forwards text-delta chunks as text events", async () => {
        const events = await collect(
            fromArray([
                { type: "text-delta", text: "hello " },
                { type: "text-delta", text: "world" },
            ]),
        );
        expect(events).toEqual([
            { type: "text", text: "hello " },
            { type: "text", text: "world" },
        ]);
    });

    it("forwards reasoning-delta chunks as text events", async () => {
        const events = await collect(
            fromArray([{ type: "reasoning-delta", text: "thinking..." }]),
        );
        expect(events).toEqual([{ type: "text", text: "thinking..." }]);
    });

    it("wraps reasoning blocks with <think> markers", async () => {
        const events = await collect(
            fromArray([
                { type: "reasoning-start" },
                { type: "reasoning-delta", text: "step 1" },
                { type: "reasoning-end" },
                { type: "text-delta", text: "answer" },
            ]),
        );
        expect(events).toEqual([
            { type: "text", text: "<think>" },
            { type: "text", text: "step 1" },
            { type: "text", text: "</think>" },
            { type: "text", text: "answer" },
        ]);
    });

    it("surfaces error chunks as error events without halting", async () => {
        const events = await collect(
            fromArray([
                { type: "text-delta", text: "before" },
                { type: "error", error: new Error("boom") },
                { type: "text-delta", text: "after" },
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

    it("drops unknown chunk types", async () => {
        const events = await collect(
            fromArray([
                { type: "finish-step" },
                { type: "tool-call", toolCallId: "x" },
                { type: "text-delta", text: "ok" },
            ]),
        );
        expect(events).toEqual([{ type: "text", text: "ok" }]);
    });

    it("propagates iteration errors via promise rejection", async () => {
        async function* failing(): AsyncIterable<ChatStreamChunk> {
            yield { type: "text-delta", text: "first" };
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
