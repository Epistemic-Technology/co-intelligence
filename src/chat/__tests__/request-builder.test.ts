import { describe, it, expect } from "vitest";
import { buildChatRequest } from "@/chat/request-builder";
import type { Model, ModelChatMessage } from "@/types";

const model: Model = {
    id: "openai:gpt-4-turbo",
    provider: "openai",
    name: "GPT-4 Turbo",
    renaming: false,
    toggleWebSearch: true,
    streaming: true,
};

const messages: ModelChatMessage[] = [
    { role: "user", content: "hello" },
    { role: "assistant", content: "hi" },
];

describe("buildChatRequest", () => {
    it("populates modelId from the supplied model", () => {
        const request = buildChatRequest({ model, messages });
        expect(request.modelId).toBe(model.id);
    });

    it("assigns a uuid-shaped requestID", () => {
        const request = buildChatRequest({ model, messages });
        expect(request.requestID).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
        );
    });

    it("issues a fresh requestID for each call", () => {
        const a = buildChatRequest({ model, messages });
        const b = buildChatRequest({ model, messages });
        expect(a.requestID).not.toBe(b.requestID);
    });

    it("snapshots the messages array so caller mutations don't leak", () => {
        const local = [...messages];
        const request = buildChatRequest({ model, messages: local });
        local.push({ role: "user", content: "mutated after build" });
        expect(request.messages).toHaveLength(2);
    });

    it("passes through optional fields", () => {
        const request = buildChatRequest({
            model,
            messages,
            context: [{ title: "note", content: "body" }],
            webSearch: true,
            systemPrompt: "be terse",
        });
        expect(request.context).toEqual([{ title: "note", content: "body" }]);
        expect(request.webSearch).toBe(true);
        expect(request.systemPrompt).toBe("be terse");
    });

    it("leaves optional fields undefined when omitted", () => {
        const request = buildChatRequest({ model, messages });
        expect(request.context).toBeUndefined();
        expect(request.webSearch).toBeUndefined();
        expect(request.systemPrompt).toBeUndefined();
    });
});
