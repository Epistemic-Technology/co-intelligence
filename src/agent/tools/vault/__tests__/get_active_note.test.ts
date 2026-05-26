import { describe, expect, it, vi } from "vitest";
import { App, TFile } from "obsidian";

import { getActiveNoteTool } from "@/agent/tools/vault/get_active_note";
import type CoIntelligencePlugin from "@/CoIntelligencePlugin";
import type { ToolExecutionContext } from "@/agent/types";

function makeCtx(app: App): ToolExecutionContext {
    return { app, plugin: {} as CoIntelligencePlugin, toolCallId: "c" };
}

describe("getActiveNoteTool", () => {
    it("returns nulls when no active file", async () => {
        const app = new App();
        app.workspace.getActiveFile = vi.fn().mockReturnValue(null);
        const out = await getActiveNoteTool.execute({}, makeCtx(app));
        expect(out).toEqual({ path: null, content: null });
    });

    it("returns path + content for an active file", async () => {
        const file = new TFile();
        file.path = "Active.md";
        const app = new App();
        app.workspace.getActiveFile = vi.fn().mockReturnValue(file);
        app.vault.cachedRead = vi.fn().mockResolvedValue("body");
        const out = await getActiveNoteTool.execute({}, makeCtx(app));
        expect(out).toEqual({ path: "Active.md", content: "body" });
    });
});
