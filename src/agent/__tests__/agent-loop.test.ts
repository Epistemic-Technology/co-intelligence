import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TextStreamPart, ToolSet, LanguageModel } from "ai";
import { translate, runAgentLoop, DEFAULT_MAX_STEPS } from "@/agent/agent-loop";
import type { AgentEvent } from "@/agent/types";

const streamTextMock = vi.hoisted(() => vi.fn());
const stepCountIsMock = vi.hoisted(() => vi.fn((n: number) => ({ __stop: n })));

vi.mock("ai", async () => {
    const actual =
        await vi.importActual<typeof import("ai")>("ai");
    return {
        ...actual,
        streamText: streamTextMock,
        stepCountIs: stepCountIsMock,
    };
});

type Chunk = TextStreamPart<ToolSet>;

async function* fromArray(chunks: Chunk[]): AsyncIterable<Chunk> {
    for (const c of chunks) yield c;
}

async function collect(
    chunks: Chunk[],
): Promise<AgentEvent[]> {
    const out: AgentEvent[] = [];
    for await (const ev of translate(fromArray(chunks))) out.push(ev);
    return out;
}

describe("translate", () => {
    it("yields nothing for an empty stream", async () => {
        expect(await collect([])).toEqual([]);
    });

    it("maps text-delta chunks to text events", async () => {
        const events = await collect([
            { type: "text-delta", id: "t1", text: "hello " },
            { type: "text-delta", id: "t1", text: "world" },
        ]);
        expect(events).toEqual([
            { type: "text", text: "hello " },
            { type: "text", text: "world" },
        ]);
    });

    it("maps reasoning-start/delta/end to dedicated events", async () => {
        const events = await collect([
            { type: "reasoning-start", id: "r1" },
            { type: "reasoning-delta", id: "r1", text: "step 1" },
            { type: "reasoning-end", id: "r1" },
        ]);
        expect(events).toEqual([
            { type: "reasoning-start" },
            { type: "reasoning-delta", text: "step 1" },
            { type: "reasoning-end" },
        ]);
    });

    it("maps a tool-call / tool-result sequence", async () => {
        const events = await collect([
            {
                type: "tool-call",
                toolCallId: "c1",
                toolName: "read_note",
                input: { path: "a.md" },
                providerExecuted: false,
                dynamic: false,
            } as unknown as Chunk,
            {
                type: "tool-result",
                toolCallId: "c1",
                toolName: "read_note",
                input: { path: "a.md" },
                output: "file contents",
                providerExecuted: false,
                dynamic: false,
            } as unknown as Chunk,
        ]);
        expect(events).toEqual([
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
                output: "file contents",
            },
        ]);
    });

    it("maps tool-input-delta chunks (id → toolCallId)", async () => {
        const events = await collect([
            {
                type: "tool-input-delta",
                id: "c1",
                delta: '{"path":',
            },
            {
                type: "tool-input-delta",
                id: "c1",
                delta: '"a.md"}',
            },
        ]);
        expect(events).toEqual([
            { type: "tool-input-delta", toolCallId: "c1", delta: '{"path":' },
            { type: "tool-input-delta", toolCallId: "c1", delta: '"a.md"}' },
        ]);
    });

    it("maps tool-error to a tool-error event", async () => {
        const events = await collect([
            {
                type: "tool-error",
                toolCallId: "c1",
                toolName: "edit_note",
                input: {},
                error: new Error("denied"),
                providerExecuted: false,
                dynamic: false,
            } as unknown as Chunk,
        ]);
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
            type: "tool-error",
            toolCallId: "c1",
            toolName: "edit_note",
        });
        expect(((events[0] as { error: Error }).error as Error).message).toBe(
            "denied",
        );
    });

    it("maps tool-approval-request to an approval-requested event", async () => {
        const events = await collect([
            {
                type: "tool-approval-request",
                approvalId: "a1",
                toolCall: {
                    type: "tool-call",
                    toolCallId: "c1",
                    toolName: "edit_note",
                    input: { path: "a.md" },
                    providerExecuted: false,
                    dynamic: false,
                },
            } as unknown as Chunk,
        ]);
        expect(events).toEqual([
            {
                type: "approval-requested",
                approvalId: "a1",
                toolCallId: "c1",
                toolName: "edit_note",
                input: { path: "a.md" },
            },
        ]);
    });

    it("maps finish-step and finish to finish events with finishReason", async () => {
        const events = await collect([
            {
                type: "finish-step",
                response: {} as never,
                usage: {} as never,
                finishReason: "tool-calls",
                rawFinishReason: undefined,
                providerMetadata: undefined,
            },
            {
                type: "finish",
                finishReason: "stop",
                rawFinishReason: undefined,
                totalUsage: {} as never,
            },
        ]);
        expect(events).toEqual([
            { type: "finish-step", finishReason: "tool-calls" },
            { type: "finish", finishReason: "stop" },
        ]);
    });

    it("maps abort to finish with finishReason 'aborted'", async () => {
        const events = await collect([
            { type: "abort", reason: "user cancelled" },
        ]);
        expect(events).toEqual([
            { type: "finish", finishReason: "aborted" },
        ]);
    });

    it("maps error chunks to error events without halting", async () => {
        const events = await collect([
            { type: "text-delta", id: "t1", text: "before" },
            { type: "error", error: new Error("boom") },
            { type: "text-delta", id: "t1", text: "after" },
        ]);
        expect(events).toHaveLength(3);
        expect(events[0]).toEqual({ type: "text", text: "before" });
        expect(events[1].type).toBe("error");
        expect(events[2]).toEqual({ type: "text", text: "after" });
    });

    it("drops chunk types it doesn't recognize", async () => {
        const events = await collect([
            { type: "start" },
            { type: "text-end", id: "t1" },
            { type: "tool-input-start", id: "c1", toolName: "x" },
            { type: "text-delta", id: "t1", text: "kept" },
        ]);
        expect(events).toEqual([{ type: "text", text: "kept" }]);
    });

    it("maps start-step chunks to start-step events", async () => {
        const events = await collect([
            { type: "start-step", request: {} as never, warnings: [] },
        ]);
        expect(events).toEqual([{ type: "start-step" }]);
    });

    it("emits events in source order across a realistic mixed stream", async () => {
        const events = await collect([
            { type: "start" },
            { type: "start-step", request: {} as never, warnings: [] },
            { type: "text-delta", id: "t1", text: "Let me check." },
            {
                type: "tool-call",
                toolCallId: "c1",
                toolName: "read_note",
                input: { path: "a.md" },
                providerExecuted: false,
                dynamic: false,
            } as unknown as Chunk,
            {
                type: "tool-result",
                toolCallId: "c1",
                toolName: "read_note",
                input: { path: "a.md" },
                output: "ok",
                providerExecuted: false,
                dynamic: false,
            } as unknown as Chunk,
            {
                type: "finish-step",
                response: {} as never,
                usage: {} as never,
                finishReason: "tool-calls",
                rawFinishReason: undefined,
                providerMetadata: undefined,
            },
            { type: "text-delta", id: "t2", text: "done" },
            {
                type: "finish",
                finishReason: "stop",
                rawFinishReason: undefined,
                totalUsage: {} as never,
            },
        ]);
        expect(events.map((e) => e.type)).toEqual([
            "start-step",
            "text",
            "tool-call",
            "tool-result",
            "finish-step",
            "text",
            "finish",
        ]);
    });

    it("propagates iteration errors", async () => {
        async function* failing(): AsyncIterable<Chunk> {
            yield { type: "text-delta", id: "t1", text: "first" };
            throw new Error("connection lost");
        }
        const iter = translate(failing());
        const first = await iter[Symbol.asyncIterator]().next();
        expect(first.value).toEqual({ type: "text", text: "first" });
        await expect(
            iter[Symbol.asyncIterator]().next(),
        ).rejects.toThrow("connection lost");
    });
});

describe("runAgentLoop", () => {
    beforeEach(() => {
        streamTextMock.mockReset();
        stepCountIsMock.mockClear();
    });

    function mockStreamResult(chunks: Chunk[]) {
        streamTextMock.mockReturnValue({
            fullStream: fromArray(chunks),
            sources: Promise.resolve([]),
        });
    }

    it("passes a stepCountIs(maxSteps) stopWhen to streamText", () => {
        mockStreamResult([]);
        runAgentLoop({
            model: {} as LanguageModel,
            messages: [],
            maxSteps: 7,
        });
        expect(stepCountIsMock).toHaveBeenCalledWith(7);
        const callArgs = streamTextMock.mock.calls[0][0];
        expect(callArgs.stopWhen).toEqual({ __stop: 7 });
    });

    it("defaults to DEFAULT_MAX_STEPS when maxSteps is omitted", () => {
        mockStreamResult([]);
        runAgentLoop({
            model: {} as LanguageModel,
            messages: [],
        });
        expect(stepCountIsMock).toHaveBeenCalledWith(DEFAULT_MAX_STEPS);
    });

    it("forwards system / tools / abortSignal / providerOptions / headers", () => {
        mockStreamResult([]);
        const abortSignal = new AbortController().signal;
        const tools: ToolSet = {};
        runAgentLoop({
            model: {} as LanguageModel,
            messages: [{ role: "user", content: "hi" }],
            system: "be terse",
            tools,
            abortSignal,
            providerOptions: { openai: { reasoningSummary: "detailed" } },
            headers: { "x-test": "1" },
        });
        const args = streamTextMock.mock.calls[0][0];
        expect(args.system).toBe("be terse");
        expect(args.tools).toBe(tools);
        expect(args.abortSignal).toBe(abortSignal);
        expect(args.providerOptions).toEqual({
            openai: { reasoningSummary: "detailed" },
        });
        expect(args.headers).toEqual({ "x-test": "1" });
    });

    it("emits the translated event stream end-to-end", async () => {
        mockStreamResult([
            { type: "text-delta", id: "t1", text: "hello " },
            {
                type: "tool-call",
                toolCallId: "c1",
                toolName: "read_note",
                input: {},
                providerExecuted: false,
                dynamic: false,
            } as unknown as Chunk,
            {
                type: "finish",
                finishReason: "stop",
                rawFinishReason: undefined,
                totalUsage: {} as never,
            },
        ]);
        const stream = runAgentLoop({
            model: {} as LanguageModel,
            messages: [],
        });
        const events: AgentEvent[] = [];
        for await (const ev of stream.events) events.push(ev);
        expect(events.map((e) => e.type)).toEqual([
            "text",
            "tool-call",
            "finish",
        ]);
    });

    it("forwards onError callbacks (unwrapping streamText's { error } shape)", () => {
        mockStreamResult([]);
        const onError = vi.fn();
        runAgentLoop({
            model: {} as LanguageModel,
            messages: [],
            onError,
        });
        const passedOnError = streamTextMock.mock.calls[0][0].onError;
        expect(passedOnError).toBeTypeOf("function");
        const err = new Error("oops");
        passedOnError({ error: err });
        expect(onError).toHaveBeenCalledWith(err);
    });

    it("exposes the underlying sources promise on the returned stream", async () => {
        const sources = Promise.resolve([{ url: "https://x", title: "X" }]);
        streamTextMock.mockReturnValue({
            fullStream: fromArray([]),
            sources,
        });
        const stream = runAgentLoop({
            model: {} as LanguageModel,
            messages: [],
        });
        expect(stream.sources).toBe(sources);
    });
});
