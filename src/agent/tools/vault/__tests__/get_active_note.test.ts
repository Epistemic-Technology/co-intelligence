import { describe, expect, it, vi } from "vitest";
import { App, TFile } from "obsidian";

import { getActiveNoteTool } from "@/agent/tools/vault/get_active_note";
import type CoIntelligencePlugin from "@/CoIntelligencePlugin";
import type { ToolExecutionContext } from "@/agent/types";

function makeCtx(app: App, lastUserFile: TFile | null): ToolExecutionContext {
    return {
        app,
        plugin: { lastUserFile } as CoIntelligencePlugin,
        toolCallId: "c",
    };
}

describe("getActiveNoteTool", () => {
    it("returns nulls when plugin has no lastUserFile", async () => {
        const out = await getActiveNoteTool.execute(
            {},
            makeCtx(new App(), null),
        );
        expect(out).toEqual({ path: null, content: null });
    });

    it("returns path + content for the tracked user file", async () => {
        const file = new TFile();
        file.path = "Active.md";
        const app = new App();
        app.vault.cachedRead = vi.fn().mockResolvedValue("body");
        const out = await getActiveNoteTool.execute({}, makeCtx(app, file));
        expect(out).toEqual({ path: "Active.md", content: "body" });
    });
});
