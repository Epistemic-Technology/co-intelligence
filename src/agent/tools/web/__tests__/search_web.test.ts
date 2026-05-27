import { describe, expect, it, vi, beforeEach } from "vitest";
import { App, requestUrl } from "obsidian";

import { pickProvider, searchWebTool } from "@/agent/tools/web/search_web";
import type CoIntelligencePlugin from "@/CoIntelligencePlugin";
import type { ToolExecutionContext } from "@/agent/types";

const mockedRequestUrl = vi.mocked(requestUrl);

function makeCtx(app: App): ToolExecutionContext {
    return { app, plugin: {} as CoIntelligencePlugin, toolCallId: "c" };
}

describe("pickProvider", () => {
    it("prefers Tavily when both keys are set", () => {
        const app = new App();
        app.secretStorage.setSecret("coi-tavily-api-key", "t");
        app.secretStorage.setSecret("coi-perplexity-api-key", "p");
        expect(pickProvider(app)).toBe("tavily");
    });

    it("falls back to Perplexity when only its key is set", () => {
        const app = new App();
        app.secretStorage.setSecret("coi-perplexity-api-key", "p");
        expect(pickProvider(app)).toBe("perplexity");
    });

    it("returns null when no provider is configured", () => {
        expect(pickProvider(new App())).toBeNull();
    });
});

describe("searchWebTool", () => {
    beforeEach(() => {
        mockedRequestUrl.mockReset();
    });

    it("throws when no provider is configured", async () => {
        await expect(
            searchWebTool.execute({ query: "hi" }, makeCtx(new App())),
        ).rejects.toThrow(/not configured: set a Tavily or Perplexity/);
    });

    it("uses Tavily when its key is set", async () => {
        const app = new App();
        app.secretStorage.setSecret("coi-tavily-api-key", "t");
        mockedRequestUrl.mockResolvedValue({
            status: 200,
            headers: {},
            text: "",
            json: {
                answer: "the answer",
                results: [
                    {
                        title: "T",
                        url: "https://a.example",
                        content: "snippet",
                    },
                ],
            },
        } as never);
        const out = await searchWebTool.execute(
            { query: "what" },
            makeCtx(app),
        );
        expect(out.provider).toBe("tavily");
        expect(out.answer).toBe("the answer");
        expect(out.citations).toEqual([
            { title: "T", url: "https://a.example", snippet: "snippet" },
        ]);
        const [args] = mockedRequestUrl.mock.calls[0];
        expect((args as { url: string }).url).toContain("tavily.com");
    });

    it("falls back to Perplexity when only its key is set", async () => {
        const app = new App();
        app.secretStorage.setSecret("coi-perplexity-api-key", "p");
        mockedRequestUrl.mockResolvedValue({
            status: 200,
            headers: {},
            text: "",
            json: {
                choices: [{ message: { content: "p-answer" } }],
                search_results: [{ url: "https://b.example" }],
            },
        } as never);
        const out = await searchWebTool.execute(
            { query: "q" },
            makeCtx(app),
        );
        expect(out.provider).toBe("perplexity");
        expect(out.answer).toBe("p-answer");
        expect(out.citations).toEqual([{ url: "https://b.example" }]);
        const [args] = mockedRequestUrl.mock.calls[0];
        expect((args as { url: string }).url).toContain("perplexity.ai");
    });

    it("accepts plain-string Perplexity citations as a fallback shape", async () => {
        const app = new App();
        app.secretStorage.setSecret("coi-perplexity-api-key", "p");
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
