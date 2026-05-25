import { describe, it, expect, beforeEach } from "vitest";
import { App } from "obsidian";
import {
    readSession,
    writeSession,
    deleteSession,
    sessionPath,
    sessionsDir,
} from "@/session/session-storage";
import { createEmptySession, type Session } from "@/session/types";
import type { CoIntelligencePlugin } from "@/CoIntelligencePlugin";

function makePlugin(): CoIntelligencePlugin {
    return {
        manifest: { id: "co-intelligence" },
    } as unknown as CoIntelligencePlugin;
}

describe("sessionsDir / sessionPath", () => {
    it("composes the sessions directory under the config dir", () => {
        const app = new App();
        const plugin = makePlugin();
        expect(sessionsDir(app, plugin)).toBe(
            ".obsidian/plugins/co-intelligence/sessions",
        );
    });

    it("composes the per-session sidecar path", () => {
        const app = new App();
        const plugin = makePlugin();
        expect(sessionPath(app, plugin, "abc-123")).toBe(
            ".obsidian/plugins/co-intelligence/sessions/abc-123.json",
        );
    });
});

describe("writeSession", () => {
    let app: App;
    let plugin: CoIntelligencePlugin;

    beforeEach(() => {
        app = new App();
        plugin = makePlugin();
    });

    it("creates the sessions directory if it doesn't exist", async () => {
        const session = createEmptySession("s1", 1000);
        await writeSession(session, app, plugin);
        expect(app.vault.adapter.mkdir).toHaveBeenCalledWith(
            ".obsidian/plugins/co-intelligence/sessions",
        );
    });

    it("writes the session as pretty-printed JSON", async () => {
        const session = createEmptySession("s1", 1000);
        await writeSession(session, app, plugin, 2000);
        const writeCalls = (app.vault.adapter.write as ReturnType<typeof vi.fn>).mock.calls;
        expect(writeCalls[0][0]).toBe(
            ".obsidian/plugins/co-intelligence/sessions/s1.json",
        );
        const written = JSON.parse(writeCalls[0][1] as string);
        expect(written.id).toBe("s1");
        expect(written.updatedAt).toBe(2000);
    });

    it("returns the stamped session with the bumped updatedAt", async () => {
        const session = createEmptySession("s1", 1000);
        const stamped = await writeSession(session, app, plugin, 5000);
        expect(stamped.updatedAt).toBe(5000);
        expect(stamped.createdAt).toBe(1000);
    });

    it("does not re-mkdir when the directory already exists", async () => {
        const session = createEmptySession("s1", 1000);
        await writeSession(session, app, plugin);
        (app.vault.adapter.mkdir as ReturnType<typeof vi.fn>).mockClear();
        await writeSession(session, app, plugin);
        expect(app.vault.adapter.mkdir).not.toHaveBeenCalled();
    });
});

describe("readSession", () => {
    let app: App;
    let plugin: CoIntelligencePlugin;

    beforeEach(() => {
        app = new App();
        plugin = makePlugin();
    });

    it("returns null when the sidecar does not exist", async () => {
        const result = await readSession("missing", app, plugin);
        expect(result).toBeNull();
    });

    it("round-trips a written session byte-for-byte", async () => {
        const session = createEmptySession("s1", 1000);
        session.messages.push({
            id: "m1",
            role: "user",
            createdAt: 1100,
            parts: [{ type: "text", text: "hello" }],
        });
        session.lastModelId = "openai:gpt-4-turbo";

        const stamped = await writeSession(session, app, plugin, 2000);
        const loaded = await readSession("s1", app, plugin);
        expect(loaded).toEqual(stamped);
    });

    it("throws on malformed JSON", async () => {
        await app.vault.adapter.write(
            sessionPath(app, plugin, "broken"),
            "not json",
        );
        await expect(readSession("broken", app, plugin)).rejects.toThrow(
            /Failed to parse session sidecar/,
        );
    });

    it("throws when the JSON doesn't match the Session shape", async () => {
        await app.vault.adapter.write(
            sessionPath(app, plugin, "wrong"),
            JSON.stringify({ id: "wrong" }),
        );
        await expect(readSession("wrong", app, plugin)).rejects.toThrow(
            /does not match the expected shape/,
        );
    });

    it("throws when the on-disk version exceeds the current SESSION_FILE_VERSION", async () => {
        const session: Session = {
            ...createEmptySession("future", 1000),
            version: 9999,
        };
        await app.vault.adapter.write(
            sessionPath(app, plugin, "future"),
            JSON.stringify(session),
        );
        await expect(readSession("future", app, plugin)).rejects.toThrow(
            /does not match the expected shape/,
        );
    });
});

describe("deleteSession", () => {
    let app: App;
    let plugin: CoIntelligencePlugin;

    beforeEach(() => {
        app = new App();
        plugin = makePlugin();
    });

    it("removes an existing sidecar", async () => {
        const session = createEmptySession("s1", 1000);
        await writeSession(session, app, plugin);
        await deleteSession("s1", app, plugin);
        expect(await readSession("s1", app, plugin)).toBeNull();
    });

    it("is a no-op for an unknown id", async () => {
        await expect(deleteSession("missing", app, plugin)).resolves.toBeUndefined();
    });
});
