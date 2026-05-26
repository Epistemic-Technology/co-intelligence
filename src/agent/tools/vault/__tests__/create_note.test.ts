import { describe, expect, it, vi } from "vitest";
import { App, TFile } from "obsidian";

import { createNoteTool } from "@/agent/tools/vault/create_note";
import type CoIntelligencePlugin from "@/CoIntelligencePlugin";
import type { ToolExecutionContext } from "@/agent/types";

function makeCtx(app: App): ToolExecutionContext {
    return { app, plugin: {} as CoIntelligencePlugin, toolCallId: "c" };
}

describe("createNoteTool", () => {
    it("requires approval", () => {
        expect(createNoteTool.requiresApproval).toBe(true);
    });

    it("creates a note with plain content", async () => {
        const app = new App();
        app.vault.getAbstractFileByPath = vi.fn().mockReturnValue(null);
        const created = new TFile();
        created.path = "n.md";
        const create = vi.fn().mockResolvedValue(created);
        app.vault.create = create;
        const out = await createNoteTool.execute(
            { path: "n.md", content: "hello" },
            makeCtx(app),
        );
        expect(create).toHaveBeenCalledWith("n.md", "hello");
        expect(out.path).toBe("n.md");
    });

    it("renders frontmatter when provided", async () => {
        const app = new App();
        app.vault.getAbstractFileByPath = vi.fn().mockReturnValue(null);
        const created = new TFile();
        created.path = "n.md";
        const create = vi.fn().mockResolvedValue(created);
        app.vault.create = create;
        await createNoteTool.execute(
            {
                path: "n.md",
                content: "body",
                frontmatter: { tags: ["x"] },
            },
            makeCtx(app),
        );
        const [, body] = create.mock.calls[0];
        expect(body).toMatch(/^---\n/);
        expect(body).toContain("tags");
        expect(body).toContain("body");
    });

    it("rejects when a file already exists at the path", async () => {
        const app = new App();
        app.vault.getAbstractFileByPath = vi.fn().mockReturnValue(new TFile());
        await expect(
            createNoteTool.execute(
                { path: "n.md", content: "" },
                makeCtx(app),
            ),
        ).rejects.toThrow(/already exists/);
    });
});
