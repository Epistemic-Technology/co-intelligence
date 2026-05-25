import { App, normalizePath } from "obsidian";
import type { CoIntelligencePlugin } from "@/CoIntelligencePlugin";
import {
    SESSION_FILE_VERSION,
    type Session,
} from "@/session/types";

const SESSIONS_DIRNAME = "sessions";

/**
 * Returns the directory holding session sidecars for this plugin.
 * Lives under the Obsidian config dir (typically `.obsidian/`) so it's
 * outside the visible vault but still travels with sync.
 */
export function sessionsDir(app: App, plugin: CoIntelligencePlugin): string {
    return normalizePath(
        `${app.vault.configDir}/plugins/${plugin.manifest.id}/${SESSIONS_DIRNAME}`,
    );
}

export function sessionPath(
    app: App,
    plugin: CoIntelligencePlugin,
    sessionId: string,
): string {
    return normalizePath(`${sessionsDir(app, plugin)}/${sessionId}.json`);
}

/**
 * Persists a Session to its JSON sidecar. Creates the sessions directory if it
 * doesn't exist yet. Bumps `updatedAt` to the supplied (or current) time.
 */
export async function writeSession(
    session: Session,
    app: App,
    plugin: CoIntelligencePlugin,
    now: number = Date.now(),
): Promise<Session> {
    const dir = sessionsDir(app, plugin);
    if (!(await app.vault.adapter.exists(dir))) {
        await app.vault.adapter.mkdir(dir);
    }
    const stamped: Session = { ...session, updatedAt: now };
    await app.vault.adapter.write(
        sessionPath(app, plugin, session.id),
        JSON.stringify(stamped, null, 2),
    );
    return stamped;
}

/**
 * Loads a Session by id. Returns `null` when no sidecar exists for the id (the
 * caller decides whether that means "fresh session" or "needs migration").
 *
 * Throws if the sidecar exists but is malformed — corruption shouldn't silently
 * fall through to "empty session" because that would silently nuke real chat
 * history.
 */
export async function readSession(
    sessionId: string,
    app: App,
    plugin: CoIntelligencePlugin,
): Promise<Session | null> {
    const path = sessionPath(app, plugin, sessionId);
    if (!(await app.vault.adapter.exists(path))) {
        return null;
    }
    const raw = await app.vault.adapter.read(path);
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch (cause) {
        throw new Error(
            `Failed to parse session sidecar at ${path}: ${
                (cause as Error).message
            }`,
        );
    }
    if (!isSessionShape(parsed)) {
        throw new Error(
            `Session sidecar at ${path} does not match the expected shape`,
        );
    }
    return parsed;
}

/**
 * Removes the sidecar for the given session id. No-op if it doesn't exist.
 */
export async function deleteSession(
    sessionId: string,
    app: App,
    plugin: CoIntelligencePlugin,
): Promise<void> {
    const path = sessionPath(app, plugin, sessionId);
    if (await app.vault.adapter.exists(path)) {
        await app.vault.adapter.remove(path);
    }
}

function isSessionShape(value: unknown): value is Session {
    if (typeof value !== "object" || value === null) return false;
    const v = value as Record<string, unknown>;
    return (
        typeof v.id === "string" &&
        typeof v.version === "number" &&
        v.version <= SESSION_FILE_VERSION &&
        Array.isArray(v.messages) &&
        typeof v.contextItems === "object" &&
        v.contextItems !== null &&
        Array.isArray(v.sources)
    );
}
