import { describe, expect, it, vi } from "vitest";
import { App, TFile, TFolder } from "obsidian";

import { readNoteTool } from "@/agent/tools/vault/read_note";
import type CoIntelligencePlugin from "@/CoIntelligencePlugin";
import type { ToolExecutionContext } from "@/agent/types";

function makeApp(overrides: {
    getAbstractFileByPath: (path: string) => unknown;
    cachedRead?: (file: TFile) => Promise<string>;
}): App {
    const app = new App();
    app.vault.getAbstractFileByPath = vi
        .fn()
        .mockImplementation(overrides.getAbstractFileByPath);
    if (overrides.cachedRead) {
        app.vault.cachedRead = vi.fn().mockImplementation(overrides.cachedRead);
    }
    return app;
}

function makeCtx(app: App): ToolExecutionContext {
    return {
        app,
        plugin: {} as CoIntelligencePlugin,
        toolCallId: "call-1",
    };
}

describe("readNoteTool", () => {
    it("is read-only with vault scope on both platforms", () => {
        expect(readNoteTool.requiresApproval).toBe(false);
        expect(readNoteTool.scope).toBe("vault");
        expect(readNoteTool.platforms).toEqual(["desktop", "mobile"]);
    });

    it("returns the cached content for an existing note", async () => {
        const file = new TFile();
        file.path = "Notes/hello.md";
        const app = makeApp({
            getAbstractFileByPath: () => file,
            cachedRead: async () => "# hello\nworld",
        });
        const out = await readNoteTool.execute(
            { path: "Notes/hello.md" },
            makeCtx(app),
        );
        expect(out).toEqual({
            path: "Notes/hello.md",
            content: "# hello\nworld",
        });
    });

    it("normalizes the path before lookup", async () => {
        const file = new TFile();
        const app = makeApp({
            getAbstractFileByPath: () => file,
            cachedRead: async () => "",
        });
        await readNoteTool.execute({ path: "Notes//hello.md" }, makeCtx(app));
        expect(app.vault.getAbstractFileByPath).toHaveBeenCalledWith(
            "Notes/hello.md",
        );
    });

    it("throws a friendly error when the path does not exist", async () => {
        const app = makeApp({ getAbstractFileByPath: () => null });
        await expect(
            readNoteTool.execute({ path: "missing.md" }, makeCtx(app)),
        ).rejects.toThrow(/Note not found at "missing.md"/);
    });

    it("throws when the path refers to a folder", async () => {
        const folder = new TFolder();
        const app = makeApp({ getAbstractFileByPath: () => folder });
        await expect(
            readNoteTool.execute({ path: "Notes" }, makeCtx(app)),
        ).rejects.toThrow(/refers to a folder/);
    });

    it("rejects empty paths at the schema level", () => {
        const parse = readNoteTool.inputSchema.safeParse({ path: "" });
        expect(parse.success).toBe(false);
    });
});
