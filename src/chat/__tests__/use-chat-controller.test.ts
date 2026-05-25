import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@solidjs/testing-library";
import { App } from "obsidian";

import { useChatController } from "@/chat/use-chat-controller";
import { createSessionStore } from "@/session/session-store";
import { createEmptySession } from "@/session/types";
import type { Model } from "@/types";
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

function buildParams(
    overrides: Partial<{ model: Model | null }> = {},
) {
    const store = createSessionStore(createEmptySession("s1", 1000));
    return {
        params: {
            app: new App(),
            plugin: {} as unknown as CoIntelligencePlugin,
            registry: {} as unknown as ModelRegistry,
            model: () => overrides.model ?? null,
            contextItems: () => null,
            store,
        },
        store,
    };
}

describe("useChatController", () => {
    it("starts with isProcessing false", () => {
        const { params } = buildParams();
        const { result } = renderHook(() => useChatController(params));
        expect(result.isProcessing()).toBe(false);
    });

    it("send() ignores empty/whitespace messages without touching the store", async () => {
        const { params, store } = buildParams({ model });
        const { result } = renderHook(() => useChatController(params));
        await result.send("   ");
        expect(store.session.messages).toEqual([]);
        expect(result.isProcessing()).toBe(false);
    });

    it("send() bails out when no model is selected", async () => {
        const consoleSpy = vi
            .spyOn(console, "error")
            .mockImplementation(() => {});
        const { params, store } = buildParams({ model: null });
        const { result } = renderHook(() => useChatController(params));
        await result.send("hello");
        expect(store.session.messages).toEqual([]);
        expect(consoleSpy).toHaveBeenCalledWith(
            "No model selected while sending message",
        );
        consoleSpy.mockRestore();
    });

    it("cancel() is a no-op when no request is in flight", () => {
        const { params, store } = buildParams({ model });
        const { result } = renderHook(() => useChatController(params));
        result.cancel();
        expect(store.session.messages).toEqual([]);
        expect(result.isProcessing()).toBe(false);
    });
});
