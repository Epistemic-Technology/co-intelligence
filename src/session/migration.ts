import type { CachedMetadata } from "obsidian";
import { App, TFile } from "obsidian";

import {
    deserializeCoiNoteContent,
    isCoiNote,
} from "@/utils/notes";
import type { CoIntelligencePlugin } from "@/CoIntelligencePlugin";
import { getSessionId, setSessionId } from "@/session/session-link";
import { writeSession } from "@/session/session-storage";
import {
    createEmptySession,
    type Session,
    type SessionMessage,
} from "@/session/types";

/**
 * Builds a {@link Session} from the legacy markdown chat format. The legacy
 * format uses `## user:` / `## assistant:` headers between CHAT-THREAD-START /
 * END markers, with a trailing `## Sources` list. The parser here delegates
 * to the existing `deserializeCoiNoteContent` and lifts the result into the
 * structured Session shape.
 *
 * Each message becomes a single `text` part — the legacy format had no
 * tool-call / reasoning / attachment surface so there's nothing to recover.
 */
export function migrateLegacyToSession(
    noteContent: string,
    metadata: CachedMetadata | null,
    app: App,
    sessionId: string,
    now: number = Date.now(),
): Session {
    const legacy = deserializeCoiNoteContent(noteContent, metadata, app);

    const session: Session = createEmptySession(sessionId, now);
    session.contextItems = {
        notes: legacy.contextItems.notes.map((file) => file.path),
        tags: legacy.contextItems.tags,
        sources: legacy.contextItems.sources,
    };
    session.sources = legacy.sources;
    session.messages = legacy.messages.map<SessionMessage>(
        (message, index) => ({
            id: `legacy-${index}`,
            role: message.role === "assistant" ? "assistant" : "user",
            createdAt: now,
            parts: [
                {
                    type: "text",
                    text: typeof message.content === "string"
                        ? message.content
                        : "",
                },
            ],
        }),
    );

    return session;
}

/**
 * Idempotent helper: if `note` is a Coi chat note without a `coi-session-id`,
 * parses its legacy markdown into a Session, writes the sidecar, and stamps
 * the new session id into the frontmatter. Returns the session id whether the
 * note was migrated or was already linked. Returns `null` for non-Coi notes.
 *
 * Safe to call on every open — does nothing when the note already has a
 * sidecar.
 */
export async function ensureSessionForNote(
    note: TFile,
    app: App,
    plugin: CoIntelligencePlugin,
    generateId: () => string = () => crypto.randomUUID(),
    now: number = Date.now(),
): Promise<string | null> {
    if (!isCoiNote(note, app)) {
        return null;
    }
    const existingId = getSessionId(note, app);
    if (existingId) {
        return existingId;
    }
    const sessionId = generateId();
    const content = await app.vault.cachedRead(note);
    const metadata = app.metadataCache.getFileCache(note);
    const session = migrateLegacyToSession(
        content,
        metadata,
        app,
        sessionId,
        now,
    );
    await writeSession(session, app, plugin, now);
    await setSessionId(note, sessionId, app);
    return sessionId;
}
