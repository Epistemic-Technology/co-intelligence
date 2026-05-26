import { describe, expect, it, vi } from "vitest";
import { App, TFile } from "obsidian";

import { editNoteTool } from "@/agent/tools/vault/edit_note";
import type CoIntelligencePlugin from "@/CoIntelligencePlugin";
import type { ToolExecutionContext } from "@/agent/types";

function makeCtx(app: App): ToolExecutionContext {
    return { app, plugin: {} as CoIntelligencePlugin, toolCallId: "c" };
}

function makeApp(initial: string): { app: App; captured: { value: string } } {
    const file = new TFile();
    file.path = "n.md";
    const captured = { value: initial };
    const app = new App();
    app.vault.getAbstractFileByPath = vi.fn().mockReturnValue(file);
    app.vault.process = vi
        .fn()
        .mockImplementation(
            async (_f: TFile, fn: (data: string) => string): Promise<string> => {
                captured.value = fn(captured.value);
                return captured.value;
            },
        );
    return { app, captured };
}

describe("editNoteTool", () => {
    it("requires approval", () => {
        expect(editNoteTool.requiresApproval).toBe(true);
    });

    it("replaces a single occurrence and returns a diff", async () => {
        const { app, captured } = makeApp("hello world\nsecond line");
        const out = await editNoteTool.execute(
            { path: "n.md", oldText: "world", newText: "there", replaceAll: false },
            makeCtx(app),
        );
        expect(captured.value).toBe("hello there\nsecond line");
        expect(out.replacements).toBe(1);
        expect(out.diff).toContain("-hello world");
        expect(out.diff).toContain("+hello there");
    });

    it("refuses ambiguous matches without replaceAll", async () => {
        const { app } = makeApp("foo\nfoo\nbar");
        await expect(
            editNoteTool.execute(
                {
                    path: "n.md",
                    oldText: "foo",
                    newText: "baz",
                    replaceAll: false,
                },
                makeCtx(app),
            ),
        ).rejects.toThrow(/appears 2 times/);
    });

    it("replaces every occurrence when replaceAll=true", async () => {
        const { app, captured } = makeApp("foo\nfoo\nbar");
        const out = await editNoteTool.execute(
            { path: "n.md", oldText: "foo", newText: "baz", replaceAll: true },
            makeCtx(app),
        );
        expect(captured.value).toBe("baz\nbaz\nbar");
        expect(out.replacements).toBe(2);
    });

    it("errors when oldText is not present", async () => {
        const { app } = makeApp("foo\nbar");
        await expect(
            editNoteTool.execute(
                {
                    path: "n.md",
                    oldText: "missing",
                    newText: "x",
                    replaceAll: false,
                },
                makeCtx(app),
            ),
        ).rejects.toThrow(/not found/);
    });
});
