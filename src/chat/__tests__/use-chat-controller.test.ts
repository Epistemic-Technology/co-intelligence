import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@solidjs/testing-library";
import { App } from "obsidian";

import { useChatController } from "@/chat/use-chat-controller";
import type { Model, ModelChatMessage, Source } from "@/types";
import type { CoIntelligencePlugin } from "@/CoIntelligencePlugin";
import type { ModelRegistry } from "@/services/model-registry";

const model: Model = {
    id: "openai:gpt-4-turbo",
    provider: "openai",
    name: "GPT-4 Turbo",
    renaming: false,
    toggleWebSearch: true,
    streaming: true,
};

function buildParams(overrides: Partial<{
    initialMessages: ModelChatMessage[];
    initialSources: Source[];
    model: Model | null;
}> = {}) {
    return {
        app: new App(),
        plugin: {} as unknown as CoIntelligencePlugin,
        registry: {} as unknown as ModelRegistry,
        model: () => overrides.model ?? null,
        contextItems: () => null,
        initialMessages: overrides.initialMessages ?? [],
        initialSources: overrides.initialSources ?? [],
    };
}

describe("useChatController", () => {
    it("exposes initial messages and sources", () => {
        const initialMessages: ModelChatMessage[] = [
            { role: "user", content: "hi" },
            { role: "assistant", content: "hello" },
        ];
        const initialSources: Source[] = [
            { url: "https://a.example", title: "A" },
        ];
        const { result } = renderHook(() =>
            useChatController(buildParams({ initialMessages, initialSources })),
        );
        expect(result.messages()).toEqual(initialMessages);
        expect(result.sources()).toEqual(initialSources);
        expect(result.isProcessing()).toBe(false);
    });

    it("send() ignores empty/whitespace messages", async () => {
        const { result } = renderHook(() =>
            useChatController(buildParams({ model })),
        );
        await result.send("   ");
        expect(result.messages()).toEqual([]);
        expect(result.isProcessing()).toBe(false);
    });

    it("send() ignores when no model is selected", async () => {
        const consoleSpy = vi
            .spyOn(console, "error")
            .mockImplementation(() => {});
        const { result } = renderHook(() =>
            useChatController(buildParams({ model: null })),
        );
        await result.send("hello");
        expect(result.messages()).toEqual([]);
        expect(consoleSpy).toHaveBeenCalledWith(
            "No model selected while sending message",
        );
        consoleSpy.mockRestore();
    });

    it("cancel() is a no-op when no request is in flight", () => {
        const { result } = renderHook(() =>
            useChatController(buildParams({ model })),
        );
        result.cancel();
        expect(result.messages()).toEqual([]);
        expect(result.isProcessing()).toBe(false);
    });
});
