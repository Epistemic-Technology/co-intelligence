import { describe, expect, it, vi } from "vitest";
import { App, TFile } from "obsidian";

import { searchVaultTool } from "@/agent/tools/vault/search_vault";
import type CoIntelligencePlugin from "@/CoIntelligencePlugin";
import type { ToolExecutionContext } from "@/agent/types";

function makeCtx(app: App): ToolExecutionContext {
    return { app, plugin: {} as CoIntelligencePlugin, toolCallId: "c" };
}

function file(name: string, path: string): TFile {
    const f = new TFile();
    f.name = `${name}.md`;
    f.basename = name;
    f.path = path;
    return f;
}

describe("searchVaultTool", () => {
    it("matches by filename, case-insensitively", async () => {
        const app = new App();
        app.vault.getMarkdownFiles = vi
            .fn()
            .mockReturnValue([
                file("Project Plan", "Project Plan.md"),
                file("notes", "notes.md"),
                file("Other", "Other.md"),
            ]);
        const out = await searchVaultTool.execute(
            { query: "project", content: false, limit: 20 },
            makeCtx(app),
        );
        expect(out.hits.map((h) => h.path)).toEqual(["Project Plan.md"]);
        expect(out.hits[0].snippet).toBeUndefined();
    });

    it("scans content and returns snippets when content=true", async () => {
        const files = [file("a", "a.md"), file("b", "b.md")];
        const app = new App();
        app.vault.getMarkdownFiles = vi.fn().mockReturnValue(files);
        app.vault.cachedRead = vi
            .fn()
            .mockImplementation(async (f: TFile) =>
                f.path === "b.md"
                    ? "lorem widget ipsum dolor sit amet widget consectetur"
                    : "nothing relevant here",
            );
        const out = await searchVaultTool.execute(
            { query: "widget", content: true, limit: 20 },
            makeCtx(app),
        );
        expect(out.hits.length).toBe(1);
        expect(out.hits[0].path).toBe("b.md");
        expect(out.hits[0].snippet).toContain("widget");
    });

    it("limits results and reports truncated=true", async () => {
        const files = Array.from({ length: 5 }, (_, i) =>
            file(`note${i}`, `note${i}.md`),
        );
        const app = new App();
        app.vault.getMarkdownFiles = vi.fn().mockReturnValue(files);
        const out = await searchVaultTool.execute(
            { query: "note", content: false, limit: 3 },
            makeCtx(app),
        );
        expect(out.hits).toHaveLength(3);
        expect(out.truncated).toBe(true);
    });

    it("returns no hits when nothing matches", async () => {
        const app = new App();
        app.vault.getMarkdownFiles = vi.fn().mockReturnValue([file("x", "x.md")]);
        const out = await searchVaultTool.execute(
            { query: "missing", content: false, limit: 20 },
            makeCtx(app),
        );
        expect(out.hits).toEqual([]);
        expect(out.truncated).toBe(false);
    });
});
