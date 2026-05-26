import { describe, expect, it, vi } from "vitest";
import { App, TFile, TFolder } from "obsidian";

import { listFolderTool } from "@/agent/tools/vault/list_folder";
import type CoIntelligencePlugin from "@/CoIntelligencePlugin";
import type { ToolExecutionContext } from "@/agent/types";

function makeCtx(app: App): ToolExecutionContext {
    return { app, plugin: {} as CoIntelligencePlugin, toolCallId: "c" };
}

function file(name: string, path: string): TFile {
    const f = new TFile();
    f.name = name;
    f.path = path;
    return f;
}

function folder(name: string, path: string, children: TFolder["children"] = []): TFolder {
    const f = new TFolder();
    f.name = name;
    f.path = path;
    f.children = children;
    return f;
}

describe("listFolderTool", () => {
    it("lists the vault root when path is empty", async () => {
        const root = folder("/", "/", [
            file("a.md", "a.md"),
            folder("Sub", "Sub"),
        ]);
        const app = new App();
        app.vault.getRoot = vi.fn().mockReturnValue(root);
        const out = await listFolderTool.execute({ path: "" }, makeCtx(app));
        expect(out.path).toBe("/");
        expect(out.entries.map((e) => e.kind)).toEqual(["folder", "file"]);
        expect(out.entries.map((e) => e.name)).toEqual(["Sub", "a.md"]);
    });

    it("lists a non-root folder", async () => {
        const sub = folder("Sub", "Sub", [
            file("b.md", "Sub/b.md"),
            file("a.md", "Sub/a.md"),
        ]);
        const app = new App();
        app.vault.getAbstractFileByPath = vi.fn().mockReturnValue(sub);
        const out = await listFolderTool.execute(
            { path: "Sub" },
            makeCtx(app),
        );
        expect(out.entries.map((e) => e.name)).toEqual(["a.md", "b.md"]);
        expect(out.entries.every((e) => e.kind === "file")).toBe(true);
    });

    it("throws when path is missing", async () => {
        const app = new App();
        app.vault.getAbstractFileByPath = vi.fn().mockReturnValue(null);
        await expect(
            listFolderTool.execute({ path: "Missing" }, makeCtx(app)),
        ).rejects.toThrow(/Folder not found/);
    });

    it("throws when path is a file, not a folder", async () => {
        const app = new App();
        app.vault.getAbstractFileByPath = vi
            .fn()
            .mockReturnValue(file("note.md", "note.md"));
        await expect(
            listFolderTool.execute({ path: "note.md" }, makeCtx(app)),
        ).rejects.toThrow(/refers to a file/);
    });
});
