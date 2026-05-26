import { describe, expect, it, vi } from "vitest";
import { App, TFile, TFolder } from "obsidian";

import { readFrontmatterTool } from "@/agent/tools/vault/read_frontmatter";
import { setFrontmatterTool } from "@/agent/tools/vault/set_frontmatter";
import type CoIntelligencePlugin from "@/CoIntelligencePlugin";
import type { ToolExecutionContext } from "@/agent/types";

function makeCtx(app: App): ToolExecutionContext {
    return { app, plugin: {} as CoIntelligencePlugin, toolCallId: "c" };
}

describe("readFrontmatterTool", () => {
    it("returns the cached frontmatter object", async () => {
        const file = new TFile();
        file.path = "n.md";
        const app = new App();
        app.vault.getAbstractFileByPath = vi.fn().mockReturnValue(file);
        app.metadataCache.getFileCache = vi
            .fn()
            .mockReturnValue({ frontmatter: { tags: ["a"], priority: 1 } });
        const out = await readFrontmatterTool.execute(
            { path: "n.md" },
            makeCtx(app),
        );
        expect(out.frontmatter).toEqual({ tags: ["a"], priority: 1 });
    });

    it("returns an empty object when no frontmatter", async () => {
        const file = new TFile();
        const app = new App();
        app.vault.getAbstractFileByPath = vi.fn().mockReturnValue(file);
        app.metadataCache.getFileCache = vi.fn().mockReturnValue(null);
        const out = await readFrontmatterTool.execute(
            { path: "n.md" },
            makeCtx(app),
        );
        expect(out.frontmatter).toEqual({});
    });

    it("throws when path is a folder", async () => {
        const app = new App();
        app.vault.getAbstractFileByPath = vi
            .fn()
            .mockReturnValue(new TFolder());
        await expect(
            readFrontmatterTool.execute({ path: "Sub" }, makeCtx(app)),
        ).rejects.toThrow(/refers to a folder/);
    });
});

describe("setFrontmatterTool", () => {
    it("requires approval", () => {
        expect(setFrontmatterTool.requiresApproval).toBe(true);
    });

    it("writes new keys and reports them", async () => {
        const file = new TFile();
        const captured: Record<string, unknown> = { existing: "keep" };
        const app = new App();
        app.vault.getAbstractFileByPath = vi.fn().mockReturnValue(file);
        app.fileManager.processFrontMatter = vi
            .fn()
            .mockImplementation(
                async (_f: TFile, fn: (fm: Record<string, unknown>) => void) =>
                    fn(captured),
            );
        const out = await setFrontmatterTool.execute(
            { path: "n.md", updates: { tags: ["x"], priority: 2 } },
            makeCtx(app),
        );
        expect(captured).toEqual({
            existing: "keep",
            tags: ["x"],
            priority: 2,
        });
        expect(out.keysWritten.sort()).toEqual(["priority", "tags"]);
        expect(out.keysRemoved).toEqual([]);
    });

    it("removes keys when value is null", async () => {
        const file = new TFile();
        const captured: Record<string, unknown> = { drop: "me", keep: 1 };
        const app = new App();
        app.vault.getAbstractFileByPath = vi.fn().mockReturnValue(file);
        app.fileManager.processFrontMatter = vi
            .fn()
            .mockImplementation(
                async (_f: TFile, fn: (fm: Record<string, unknown>) => void) =>
                    fn(captured),
            );
        const out = await setFrontmatterTool.execute(
            { path: "n.md", updates: { drop: null } },
            makeCtx(app),
        );
        expect(captured).toEqual({ keep: 1 });
        expect(out.keysRemoved).toEqual(["drop"]);
    });
});
