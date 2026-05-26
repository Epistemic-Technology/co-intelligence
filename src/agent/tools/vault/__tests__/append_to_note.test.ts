import { describe, expect, it, vi } from "vitest";
import { App, TFile } from "obsidian";

import { appendToNoteTool } from "@/agent/tools/vault/append_to_note";
import type CoIntelligencePlugin from "@/CoIntelligencePlugin";
import type { ToolExecutionContext } from "@/agent/types";

function makeCtx(app: App): ToolExecutionContext {
    return { app, plugin: {} as CoIntelligencePlugin, toolCallId: "c" };
}

function makeAppWithFile(initial: string): {
    app: App;
    captured: { value: string };
} {
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

describe("appendToNoteTool", () => {
    it("requires approval", () => {
        expect(appendToNoteTool.requiresApproval).toBe(true);
    });

    it("appends with a blank-line separator when needed", async () => {
        const { app, captured } = makeAppWithFile("line one");
        await appendToNoteTool.execute(
            { path: "n.md", content: "line two" },
            makeCtx(app),
        );
        expect(captured.value).toBe("line one\n\nline two");
    });

    it("preserves the existing trailing separator", async () => {
        const { app, captured } = makeAppWithFile("line one\n\n");
        await appendToNoteTool.execute(
            { path: "n.md", content: "line two" },
            makeCtx(app),
        );
        expect(captured.value).toBe("line one\n\nline two");
    });

    it("inserts only a single newline when there is already one", async () => {
        const { app, captured } = makeAppWithFile("line one\n");
        await appendToNoteTool.execute(
            { path: "n.md", content: "line two" },
            makeCtx(app),
        );
        expect(captured.value).toBe("line one\n\nline two");
    });

    it("appends without separator to an empty file", async () => {
        const { app, captured } = makeAppWithFile("");
        await appendToNoteTool.execute(
            { path: "n.md", content: "hello" },
            makeCtx(app),
        );
        expect(captured.value).toBe("hello");
    });
});
