import { describe, it, expect } from "vitest";
import { createRoot } from "solid-js";
import { createSessionStore } from "@/session/session-store";
import { createEmptySession } from "@/session/types";

function withRoot<T>(fn: () => T): T {
    let value: T;
    createRoot(() => {
        value = fn();
    });
    return value!;
}

describe("createSessionStore", () => {
    it("seeds from an empty session", () => {
        withRoot(() => {
            const store = createSessionStore(createEmptySession("s1", 1000));
            expect(store.session.id).toBe("s1");
            expect(store.session.messages).toEqual([]);
        });
    });

    it("appendUserMessage adds a message with a text part and returns its id", () => {
        withRoot(() => {
            const store = createSessionStore(createEmptySession("s1", 1000));
            const id = store.appendUserMessage("hi", 1500);
            expect(store.session.messages).toHaveLength(1);
            expect(store.session.messages[0].id).toBe(id);
            expect(store.session.messages[0].role).toBe("user");
            expect(store.session.messages[0].parts).toEqual([
                { type: "text", text: "hi" },
            ]);
            expect(store.session.updatedAt).toBe(1500);
        });
    });

    it("beginAssistantMessage adds an empty assistant message", () => {
        withRoot(() => {
            const store = createSessionStore(createEmptySession("s1", 1000));
            const id = store.beginAssistantMessage(1500);
            expect(store.session.messages).toHaveLength(1);
            expect(store.session.messages[0].id).toBe(id);
            expect(store.session.messages[0].role).toBe("assistant");
            expect(store.session.messages[0].parts).toEqual([]);
        });
    });

    it("appendAssistantText appends to the last text part when present", () => {
        withRoot(() => {
            const store = createSessionStore(createEmptySession("s1", 1000));
            const id = store.beginAssistantMessage();
            store.appendAssistantText(id, "hello ");
            store.appendAssistantText(id, "world");
            expect(store.session.messages[0].parts).toEqual([
                { type: "text", text: "hello world" },
            ]);
        });
    });

    it("appendAssistantText starts a new text part when the previous part isn't text", () => {
        withRoot(() => {
            const store = createSessionStore(createEmptySession("s1", 1000));
            const id = store.beginAssistantMessage();
            store.appendAssistantText(id, "before tool");
            store.addToolCallPart(id, {
                type: "tool-call",
                toolCallId: "c1",
                toolName: "x",
                input: {},
                status: "pending",
            });
            store.appendAssistantText(id, "after tool");
            const parts = store.session.messages[0].parts;
            expect(parts).toHaveLength(3);
            expect(parts[2]).toEqual({ type: "text", text: "after tool" });
        });
    });

    it("replaceLastTextPart overwrites the most recent text part", () => {
        withRoot(() => {
            const store = createSessionStore(createEmptySession("s1", 1000));
            const id = store.beginAssistantMessage();
            store.appendAssistantText(id, "original");
            store.replaceLastTextPart(id, "rewritten with [1](url)");
            expect(store.session.messages[0].parts).toEqual([
                { type: "text", text: "rewritten with [1](url)" },
            ]);
        });
    });

    it("updateToolCallStatus mutates a single tool-call part by id", () => {
        withRoot(() => {
            const store = createSessionStore(createEmptySession("s1", 1000));
            const id = store.beginAssistantMessage();
            store.addToolCallPart(id, {
                type: "tool-call",
                toolCallId: "c1",
                toolName: "x",
                input: {},
                status: "pending",
            });
            store.addToolCallPart(id, {
                type: "tool-call",
                toolCallId: "c2",
                toolName: "y",
                input: {},
                status: "pending",
            });
            store.updateToolCallStatus(id, "c1", "success");
            const parts = store.session.messages[0]
                .parts as Array<{ type: string; toolCallId?: string; status?: string }>;
            expect(parts[0].status).toBe("success");
            expect(parts[1].status).toBe("pending");
        });
    });

    it("addToolResultPart appends a tool-result part", () => {
        withRoot(() => {
            const store = createSessionStore(createEmptySession("s1", 1000));
            const id = store.beginAssistantMessage();
            store.addToolResultPart(id, {
                type: "tool-result",
                toolCallId: "c1",
                toolName: "x",
                output: "ok",
            });
            expect(store.session.messages[0].parts).toEqual([
                {
                    type: "tool-result",
                    toolCallId: "c1",
                    toolName: "x",
                    output: "ok",
                },
            ]);
        });
    });

    it("addSources appends sources (and skips when empty)", () => {
        withRoot(() => {
            const store = createSessionStore(createEmptySession("s1", 1000));
            store.addSources([]);
            expect(store.session.sources).toEqual([]);
            store.addSources([
                { url: "https://a", title: "A" },
                { url: "https://b", title: "B" },
            ]);
            store.addSources([{ url: "https://c", title: "C" }]);
            expect(store.session.sources.map((s) => s.url)).toEqual([
                "https://a",
                "https://b",
                "https://c",
            ]);
        });
    });

    it("setContextItems / setLastModelId update their fields", () => {
        withRoot(() => {
            const store = createSessionStore(createEmptySession("s1", 1000));
            store.setContextItems({
                notes: ["a.md"],
                tags: ["#x"],
                sources: [],
            });
            store.setLastModelId("openai:gpt-4-turbo");
            expect(store.session.contextItems.notes).toEqual(["a.md"]);
            expect(store.session.lastModelId).toBe("openai:gpt-4-turbo");
        });
    });

    it("replaceSession swaps the underlying state", () => {
        withRoot(() => {
            const store = createSessionStore(createEmptySession("s1", 1000));
            store.appendUserMessage("first");
            const fresh = createEmptySession("s2", 2000);
            fresh.messages.push({
                id: "m1",
                role: "assistant",
                createdAt: 2000,
                parts: [{ type: "text", text: "imported" }],
            });
            store.replaceSession(fresh);
            expect(store.session.id).toBe("s2");
            expect(store.session.messages).toHaveLength(1);
            expect(store.session.messages[0].parts[0]).toEqual({
                type: "text",
                text: "imported",
            });
        });
    });
});
