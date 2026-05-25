import { describe, it, expect } from "vitest";
import {
    SESSION_FILE_VERSION,
    createEmptySession,
    messageText,
    type SessionMessage,
} from "@/session/types";

describe("createEmptySession", () => {
    it("returns a session with the supplied id and current version", () => {
        const session = createEmptySession("s1", 1_000);
        expect(session.id).toBe("s1");
        expect(session.version).toBe(SESSION_FILE_VERSION);
        expect(session.createdAt).toBe(1_000);
        expect(session.updatedAt).toBe(1_000);
        expect(session.messages).toEqual([]);
        expect(session.contextItems).toEqual({
            notes: [],
            tags: [],
            sources: [],
        });
        expect(session.sources).toEqual([]);
        expect(session.lastModelId).toBeNull();
    });

    it("defaults createdAt/updatedAt to Date.now() when omitted", () => {
        const before = Date.now();
        const session = createEmptySession("s2");
        const after = Date.now();
        expect(session.createdAt).toBeGreaterThanOrEqual(before);
        expect(session.createdAt).toBeLessThanOrEqual(after);
        expect(session.updatedAt).toBe(session.createdAt);
    });
});

describe("messageText", () => {
    const baseMessage = {
        id: "m1",
        role: "assistant",
        createdAt: 0,
    } satisfies Omit<SessionMessage, "parts">;

    it("returns empty string for a message with no parts", () => {
        expect(messageText({ ...baseMessage, parts: [] })).toBe("");
    });

    it("concatenates text parts in order", () => {
        const result = messageText({
            ...baseMessage,
            parts: [
                { type: "text", text: "hello " },
                { type: "text", text: "world" },
            ],
        });
        expect(result).toBe("hello world");
    });

    it("skips non-text parts (reasoning, tool-call, tool-result, attachment)", () => {
        const result = messageText({
            ...baseMessage,
            parts: [
                { type: "text", text: "Before " },
                { type: "reasoning", text: "internal thought" },
                {
                    type: "tool-call",
                    toolCallId: "c1",
                    toolName: "read_note",
                    input: {},
                    status: "success",
                },
                {
                    type: "tool-result",
                    toolCallId: "c1",
                    toolName: "read_note",
                    output: "x",
                },
                { type: "text", text: "after" },
                {
                    type: "attachment",
                    id: "a1",
                    mimeType: "image/png",
                },
            ],
        });
        expect(result).toBe("Before after");
    });
});
