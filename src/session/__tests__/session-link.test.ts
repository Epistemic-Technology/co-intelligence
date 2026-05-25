import { describe, it, expect, beforeEach, vi } from "vitest";
import { App, TFile } from "obsidian";
import {
    getSessionId,
    setSessionId,
    findNoteBySessionId,
} from "@/session/session-link";

function makeFile(path: string): TFile {
    const f = new TFile();
    f.path = path;
    f.basename = path.replace(/\.md$/, "");
    return f;
}

describe("getSessionId", () => {
    let app: App;
    beforeEach(() => {
        app = new App();
    });

    it("returns the id from frontmatter when present", () => {
        const file = makeFile("a.md");
        vi.mocked(app.metadataCache.getFileCache).mockReturnValue({
            frontmatter: { "coi-session-id": "abc-123" },
        } as never);
        expect(getSessionId(file, app)).toBe("abc-123");
    });

    it("returns undefined when the key is absent", () => {
        const file = makeFile("a.md");
        vi.mocked(app.metadataCache.getFileCache).mockReturnValue({
            frontmatter: {},
        } as never);
        expect(getSessionId(file, app)).toBeUndefined();
    });

    it("returns undefined when there's no cache entry at all", () => {
        const file = makeFile("a.md");
        vi.mocked(app.metadataCache.getFileCache).mockReturnValue(null);
        expect(getSessionId(file, app)).toBeUndefined();
    });
});

describe("setSessionId", () => {
    let app: App;
    beforeEach(() => {
        app = new App();
    });

    it("writes the id when the frontmatter key is missing", async () => {
        const file = makeFile("a.md");
        vi.mocked(app.metadataCache.getFileCache).mockReturnValue({
            frontmatter: {},
        } as never);

        let captured: Record<string, unknown> = {};
        vi.mocked(app.fileManager.processFrontMatter).mockImplementation(
            async (_file, fn) => {
                fn(captured);
            },
        );

        await setSessionId(file, "abc-123", app);
        expect(captured["coi-session-id"]).toBe("abc-123");
    });

    it("skips processFrontMatter when the id is already current", async () => {
        const file = makeFile("a.md");
        vi.mocked(app.metadataCache.getFileCache).mockReturnValue({
            frontmatter: { "coi-session-id": "abc-123" },
        } as never);

        await setSessionId(file, "abc-123", app);
        expect(app.fileManager.processFrontMatter).not.toHaveBeenCalled();
    });

    it("overwrites a different existing id", async () => {
        const file = makeFile("a.md");
        vi.mocked(app.metadataCache.getFileCache).mockReturnValue({
            frontmatter: { "coi-session-id": "old" },
        } as never);

        let captured: Record<string, unknown> = { "coi-session-id": "old" };
        vi.mocked(app.fileManager.processFrontMatter).mockImplementation(
            async (_file, fn) => {
                fn(captured);
            },
        );

        await setSessionId(file, "new", app);
        expect(captured["coi-session-id"]).toBe("new");
    });
});

describe("findNoteBySessionId", () => {
    let app: App;
    beforeEach(() => {
        app = new App();
    });

    it("returns the first file with a matching coi-session-id", () => {
        const a = makeFile("a.md");
        const b = makeFile("b.md");
        const c = makeFile("c.md");
        vi.mocked(app.vault.getMarkdownFiles).mockReturnValue([a, b, c]);
        vi.mocked(app.metadataCache.getFileCache).mockImplementation((f) => {
            if (f === a) return { frontmatter: {} } as never;
            if (f === b) return { frontmatter: { "coi-session-id": "match" } } as never;
            return { frontmatter: { "coi-session-id": "other" } } as never;
        });
        expect(findNoteBySessionId("match", app)).toBe(b);
    });

    it("returns null when no note has a matching id", () => {
        const a = makeFile("a.md");
        vi.mocked(app.vault.getMarkdownFiles).mockReturnValue([a]);
        vi.mocked(app.metadataCache.getFileCache).mockReturnValue({
            frontmatter: { "coi-session-id": "other" },
        } as never);
        expect(findNoteBySessionId("missing", app)).toBeNull();
    });
});
