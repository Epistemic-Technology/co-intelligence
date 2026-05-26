import { describe, expect, it, vi, beforeEach } from "vitest";
import { App, requestUrl } from "obsidian";

import { fetchUrlTool } from "@/agent/tools/web/fetch_url";
import type CoIntelligencePlugin from "@/CoIntelligencePlugin";
import type { ToolExecutionContext } from "@/agent/types";

function makeCtx(): ToolExecutionContext {
    return {
        app: new App(),
        plugin: {} as CoIntelligencePlugin,
        toolCallId: "c",
    };
}

const mockedRequestUrl = vi.mocked(requestUrl);

describe("fetchUrlTool", () => {
    beforeEach(() => {
        mockedRequestUrl.mockReset();
    });

    it("returns markdown and extracted title for HTML", async () => {
        mockedRequestUrl.mockResolvedValue({
            status: 200,
            headers: { "content-type": "text/html; charset=utf-8" },
            text: "<html><head><title>  Example  </title></head><body><p>hi</p></body></html>",
        } as never);
        const out = await fetchUrlTool.execute(
            { url: "https://example.com" },
            makeCtx(),
        );
        expect(out.status).toBe(200);
        expect(out.title).toBe("Example");
        expect(out.markdown).toContain("hi");
    });

    it("returns text as-is for non-HTML content", async () => {
        mockedRequestUrl.mockResolvedValue({
            status: 200,
            headers: { "content-type": "application/json" },
            text: '{"a":1}',
        } as never);
        const out = await fetchUrlTool.execute(
            { url: "https://api.example.com/foo" },
            makeCtx(),
        );
        expect(out.title).toBeNull();
        expect(out.markdown).toBe('{"a":1}');
    });

    it("rejects invalid URLs at schema validation", () => {
        const parse = fetchUrlTool.inputSchema.safeParse({ url: "not-a-url" });
        expect(parse.success).toBe(false);
    });
});
