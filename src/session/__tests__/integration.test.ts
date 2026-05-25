import { describe, it, expect, beforeEach, vi } from "vitest";
import { App, TFile } from "obsidian";

import { ensureSessionForNote } from "@/session/migration";
import { renderSessionIntoNote } from "@/session/render-markdown";
import { readSession, writeSession } from "@/session/session-storage";
import { createEmptySession } from "@/session/types";
import { createSessionStore } from "@/session/session-store";
import type { CoIntelligencePlugin } from "@/CoIntelligencePlugin";

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

const LEGACY_NOTE = [
    "---",
    "is-coi-chat: true",
    "coi-chat-view: true",
    "---",
    "<!-- CHAT-THREAD-START -->",
    "## user:",
    "",
    "What's two plus two?",
    "",
    "## assistant:",
    "",
    "Four.",
    "<!-- CHAT-THREAD-END -->",
].join("\n");

describe("session round-trip", () => {
    let app: App;
    let plugin: CoIntelligencePlugin;

    beforeEach(() => {
        app = new App();
        plugin = makePlugin();
    });

    it("write → read returns the same session", async () => {
        const original = createEmptySession("rt-1", 1000);
        original.messages.push(
            {
                id: "m1",
                role: "user",
                createdAt: 1100,
                parts: [{ type: "text", text: "hi" }],
            },
            {
                id: "m2",
                role: "assistant",
                createdAt: 1200,
                parts: [
                    { type: "reasoning", text: "thinking" },
                    { type: "text", text: "hello back" },
                    {
                        type: "tool-call",
                        toolCallId: "c1",
                        toolName: "read_note",
                        input: { path: "a.md" },
                        status: "success",
                    },
                    {
                        type: "tool-result",
                        toolCallId: "c1",
                        toolName: "read_note",
                        output: "file contents",
                    },
                ],
            },
        );
        original.sources.push({
            url: "https://a.example",
            title: "A",
        });
        original.contextItems.notes.push("notes/A.md");
        original.lastModelId = "openai:gpt-4-turbo";

        const stamped = await writeSession(original, app, plugin, 2000);
        const loaded = await readSession("rt-1", app, plugin);
        expect(loaded).toEqual(stamped);
    });

    it("store mutations preserved through write → read cycle", async () => {
        const store = createSessionStore(createEmptySession("rt-2", 1000));
        const uId = store.appendUserMessage("question");
        const aId = store.beginAssistantMessage();
        store.appendAssistantText(aId, "answer ");
        store.appendAssistantText(aId, "from store");
        store.addSources([{ url: "https://x", title: "X" }]);
        store.setContextItems({
            notes: ["notes/B.md"],
            tags: ["#topic"],
            sources: [],
        });
        store.setLastModelId("anthropic:claude-3-sonnet");

        await writeSession(store.session, app, plugin);
        const loaded = await readSession("rt-2", app, plugin);

        expect(loaded).not.toBeNull();
        expect(loaded!.messages).toHaveLength(2);
        expect(loaded!.messages[0].id).toBe(uId);
        expect(loaded!.messages[1].parts).toEqual([
            { type: "text", text: "answer from store" },
        ]);
        expect(loaded!.sources).toEqual([
            { url: "https://x", title: "X" },
        ]);
        expect(loaded!.contextItems).toEqual({
            notes: ["notes/B.md"],
            tags: ["#topic"],
            sources: [],
        });
        expect(loaded!.lastModelId).toBe("anthropic:claude-3-sonnet");
    });
});

describe("legacy migration", () => {
    let app: App;
    let plugin: CoIntelligencePlugin;
    let note: TFile;

    beforeEach(() => {
        app = new App();
        plugin = makePlugin();
        note = makeNote();
        vi.mocked(app.vault.cachedRead).mockResolvedValue(LEGACY_NOTE);
        const frontmatter: Record<string, unknown> = {
            "is-coi-chat": true,
            "coi-chat-view": true,
        };
        vi.mocked(app.metadataCache.getFileCache).mockReturnValue({
            frontmatter,
        } as never);
        vi.mocked(app.fileManager.processFrontMatter).mockImplementation(
            async (_file, fn) => {
                const fm = { ...frontmatter };
                fn(fm);
                Object.assign(frontmatter, fm);
            },
        );
    });

    it("first open: migrates to a sidecar + stamps frontmatter id", async () => {
        const id = await ensureSessionForNote(
            note,
            app,
            plugin,
            () => "mig-1",
            1000,
        );
        expect(id).toBe("mig-1");

        const loaded = await readSession("mig-1", app, plugin);
        expect(loaded).not.toBeNull();
        expect(loaded!.messages.map((m) => m.role)).toEqual([
            "user",
            "assistant",
        ]);
        expect(loaded!.messages[0].parts[0]).toEqual({
            type: "text",
            text: "What's two plus two?",
        });
    });

    it("migrate → edit → reload preserves edits", async () => {
        const id = await ensureSessionForNote(
            note,
            app,
            plugin,
            () => "mig-2",
            1000,
        );
        const session = (await readSession(id!, app, plugin))!;

        // Simulate a UI session-store edit cycle: append a new assistant message
        // and persist.
        const store = createSessionStore(session);
        const aId = store.beginAssistantMessage();
        store.appendAssistantText(aId, "fresh edit after migration");
        store.addSources([{ url: "https://new", title: "New" }]);
        await writeSession(store.session, app, plugin, 2000);

        // Second open: ensureSessionForNote returns the existing id without
        // re-migrating, and readSession sees the edit.
        const idAgain = await ensureSessionForNote(note, app, plugin);
        expect(idAgain).toBe("mig-2");
        const reloaded = (await readSession(idAgain!, app, plugin))!;
        expect(reloaded.messages).toHaveLength(3);
        expect(reloaded.messages[2].parts[0]).toEqual({
            type: "text",
            text: "fresh edit after migration",
        });
        expect(reloaded.sources).toEqual([
            { url: "https://new", title: "New" },
        ]);
    });
});

describe("session → markdown regen is sidecar-driven", () => {
    let app: App;
    let plugin: CoIntelligencePlugin;

    beforeEach(() => {
        app = new App();
        plugin = makePlugin();
    });

    it("regenerated markdown reflects the latest session state", async () => {
        const original = [
            "<!-- CHAT-THREAD-START -->",
            "old body",
            "<!-- CHAT-THREAD-END -->",
        ].join("\n");

        const store = createSessionStore(createEmptySession("md-1", 1000));
        store.appendUserMessage("new question");
        const aId = store.beginAssistantMessage();
        store.appendAssistantText(aId, "new answer");
        await writeSession(store.session, app, plugin);

        const rendered = renderSessionIntoNote(original, store.session);
        expect(rendered).toContain("## user:\n\nnew question");
        expect(rendered).toContain("## assistant:\n\nnew answer");
        expect(rendered).not.toContain("old body");
    });
});
