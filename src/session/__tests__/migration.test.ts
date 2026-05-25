import { describe, it, expect, beforeEach, vi } from "vitest";
import { App, TFile } from "obsidian";

import {
    migrateLegacyToSession,
    ensureSessionForNote,
} from "@/session/migration";
import { readSession } from "@/session/session-storage";
import { getSessionId } from "@/session/session-link";
import type { CoIntelligencePlugin } from "@/CoIntelligencePlugin";

const LEGACY_NOTE = [
    "<!-- CHAT-THREAD-START -->",
    "## user:",
    "",
    "What's two plus two?",
    "",
    "## assistant:",
    "",
    "Four.",
    "",
    "## Sources",
    "",
    "1. [Wikipedia](https://en.wikipedia.org/wiki/Addition)",
    "<!-- CHAT-THREAD-END -->",
].join("\n");

function makePlugin(): CoIntelligencePlugin {
    return {
        manifest: { id: "co-intelligence" },
    } as unknown as CoIntelligencePlugin;
}

function makeNote(path = "chat.md"): TFile {
    const f = new TFile();
    f.path = path;
    f.basename = "chat";
    return f;
}

describe("migrateLegacyToSession", () => {
    let app: App;

    beforeEach(() => {
        app = new App();
    });

    it("converts legacy user/assistant turns into Session messages", () => {
        const session = migrateLegacyToSession(
            LEGACY_NOTE,
            { frontmatter: { "is-coi-chat": true } } as never,
            app,
            "sess-1",
            1000,
        );
        expect(session.id).toBe("sess-1");
        expect(session.messages).toHaveLength(2);
        expect(session.messages[0].role).toBe("user");
        expect(session.messages[0].parts).toEqual([
            { type: "text", text: "What's two plus two?" },
        ]);
        expect(session.messages[1].role).toBe("assistant");
        expect(session.messages[1].parts).toEqual([
            { type: "text", text: "Four." },
        ]);
    });

    it("lifts legacy sources into the Session sources list", () => {
        const session = migrateLegacyToSession(
            LEGACY_NOTE,
            null,
            app,
            "sess-1",
        );
        expect(session.sources).toEqual([
            {
                title: "Wikipedia",
                url: "https://en.wikipedia.org/wiki/Addition",
            },
        ]);
    });

    it("stores linked-notes by path (no TFile references)", () => {
        const linked = new TFile();
        linked.path = "notes/A.md";
        vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(linked);

        const session = migrateLegacyToSession(
            LEGACY_NOTE,
            {
                frontmatter: {
                    "linked-notes": ["notes/A.md"],
                    "linked-tags": ["#x"],
                },
            } as never,
            app,
            "sess-1",
        );
        expect(session.contextItems.notes).toEqual(["notes/A.md"]);
        expect(session.contextItems.tags).toEqual(["#x"]);
    });

    it("returns an empty session for notes without chat markers", () => {
        const session = migrateLegacyToSession(
            "no markers here",
            null,
            app,
            "sess-1",
            1000,
        );
        expect(session.messages).toEqual([]);
        expect(session.sources).toEqual([]);
    });
});

describe("ensureSessionForNote", () => {
    let app: App;
    let plugin: CoIntelligencePlugin;

    beforeEach(() => {
        app = new App();
        plugin = makePlugin();
    });

    it("returns null for non-Coi notes (no side effects)", async () => {
        const note = makeNote();
        vi.mocked(app.metadataCache.getFileCache).mockReturnValue({
            frontmatter: { "is-coi-chat": false },
        } as never);
        const result = await ensureSessionForNote(note, app, plugin);
        expect(result).toBeNull();
        expect(app.fileManager.processFrontMatter).not.toHaveBeenCalled();
    });

    it("returns the existing id without re-migrating when already linked", async () => {
        const note = makeNote();
        vi.mocked(app.metadataCache.getFileCache).mockReturnValue({
            frontmatter: {
                "is-coi-chat": true,
                "coi-session-id": "existing",
            },
        } as never);
        const result = await ensureSessionForNote(note, app, plugin);
        expect(result).toBe("existing");
        expect(app.fileManager.processFrontMatter).not.toHaveBeenCalled();
        expect(app.vault.adapter.write).not.toHaveBeenCalled();
    });

    it("migrates a legacy note: writes sidecar, stamps frontmatter id", async () => {
        const note = makeNote();
        vi.mocked(app.metadataCache.getFileCache).mockReturnValue({
            frontmatter: { "is-coi-chat": true },
        } as never);
        vi.mocked(app.vault.cachedRead).mockResolvedValue(LEGACY_NOTE);
        const captured: Record<string, unknown> = {};
        vi.mocked(app.fileManager.processFrontMatter).mockImplementation(
            async (_file, fn) => {
                fn(captured);
            },
        );

        const id = await ensureSessionForNote(
            note,
            app,
            plugin,
            () => "new-id",
            1000,
        );

        expect(id).toBe("new-id");
        expect(captured["coi-session-id"]).toBe("new-id");

        const loaded = await readSession("new-id", app, plugin);
        expect(loaded).not.toBeNull();
        expect(loaded!.id).toBe("new-id");
        expect(loaded!.messages).toHaveLength(2);
    });

    it("is idempotent — a second call returns the same id and doesn't re-write", async () => {
        const note = makeNote();
        const cachedFm = {
            frontmatter: { "is-coi-chat": true } as Record<string, unknown>,
        };
        vi.mocked(app.metadataCache.getFileCache).mockImplementation(
            () => cachedFm as never,
        );
        vi.mocked(app.vault.cachedRead).mockResolvedValue(LEGACY_NOTE);
        vi.mocked(app.fileManager.processFrontMatter).mockImplementation(
            async (_file, fn) => {
                const fm: Record<string, unknown> = { ...cachedFm.frontmatter };
                fn(fm);
                cachedFm.frontmatter = fm;
            },
        );

        const first = await ensureSessionForNote(
            note,
            app,
            plugin,
            () => "id-1",
            1000,
        );
        expect(first).toBe("id-1");
        expect(getSessionId(note, app)).toBe("id-1");

        vi.mocked(app.fileManager.processFrontMatter).mockClear();
        const writeMock = app.vault.adapter.write as ReturnType<typeof vi.fn>;
        writeMock.mockClear();

        const second = await ensureSessionForNote(
            note,
            app,
            plugin,
            () => "id-2",
            2000,
        );
        expect(second).toBe("id-1");
        expect(writeMock).not.toHaveBeenCalled();
        expect(app.fileManager.processFrontMatter).not.toHaveBeenCalled();
    });
});
