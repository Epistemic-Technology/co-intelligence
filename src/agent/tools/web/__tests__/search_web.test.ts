import { describe, expect, it, vi, beforeEach } from "vitest";
import { App, requestUrl } from "obsidian";

import {
    isSearchWebAvailable,
    searchWebTool,
} from "@/agent/tools/web/search_web";
import type CoIntelligencePlugin from "@/CoIntelligencePlugin";
import type { ToolExecutionContext } from "@/agent/types";

const mockedRequestUrl = vi.mocked(requestUrl);

function makeCtx(app: App): ToolExecutionContext {
    return { app, plugin: {} as CoIntelligencePlugin, toolCallId: "c" };
}

describe("searchWebTool", () => {
    beforeEach(() => {
        mockedRequestUrl.mockReset();
    });

    it("throws when no Perplexity key is configured", async () => {
        const app = new App();
        await expect(
            searchWebTool.execute({ query: "hello" }, makeCtx(app)),
        ).rejects.toThrow(/not configured/);
    });

    it("returns answer and citations from a sonar response", async () => {
        const app = new App();
        app.secretStorage.setSecret("coi-perplexity-api-key", "test-key");
        mockedRequestUrl.mockResolvedValue({
            status: 200,
            headers: {},
            text: "",
            json: {
                choices: [{ message: { content: "the answer" } }],
                search_results: [
                    { title: "Title A", url: "https://a.example", snippet: "a..." },
                    { url: "https://b.example" },
                ],
            },
        } as never);
        const out = await searchWebTool.execute(
            { query: "what is X" },
            makeCtx(app),
        );
        expect(out.answer).toBe("the answer");
        expect(out.citations).toEqual([
            {
                title: "Title A",
                url: "https://a.example",
                snippet: "a...",
            },
            { url: "https://b.example" },
        ]);
    });

    it("accepts plain-string citations as a fallback shape", async () => {
        const app = new App();
        app.secretStorage.setSecret("coi-perplexity-api-key", "test-key");
        mockedRequestUrl.mockResolvedValue({
            status: 200,
            headers: {},
            text: "",
            json: {
                choices: [{ message: { content: "x" } }],
                citations: ["https://x.example"],
            },
        } as never);
        const out = await searchWebTool.execute(
            { query: "q" },
            makeCtx(app),
        );
        expect(out.citations).toEqual([{ url: "https://x.example" }]);
    });
});

describe("isSearchWebAvailable", () => {
    it("is false without a key", () => {
        expect(isSearchWebAvailable(new App())).toBe(false);
    });

    it("is true with a key configured", () => {
        const app = new App();
        app.secretStorage.setSecret("coi-perplexity-api-key", "k");
        expect(isSearchWebAvailable(app)).toBe(true);
    });
});
