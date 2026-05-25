import { createStore, produce, type Store } from "solid-js/store";
import type { ModelId, Source } from "@/types";
import type {
    MessagePart,
    SerializedContextItems,
    Session,
    ToolCallStatus,
} from "@/session/types";

type ToolCallPart = Extract<MessagePart, { type: "tool-call" }>;
type ToolResultPart = Extract<MessagePart, { type: "tool-result" }>;

export interface SessionStore {
    /** Reactive view of the session. Use Solid's reactivity to read fields. */
    readonly session: Store<Session>;

    /** Adds a user message with a single text part. Returns the new message id. */
    appendUserMessage(text: string, now?: number): string;

    /** Adds an empty assistant message. Returns the new message id. */
    beginAssistantMessage(now?: number): string;

    /**
     * Appends `text` to the last text part of `messageId`, or adds a new text
     * part if the last part is not text (e.g. came after a tool-result).
     */
    appendAssistantText(messageId: string, text: string): void;

    /**
     * Replaces the last text part of `messageId` with `text`. Used by the
     * source-processor after rewriting numbered references.
     */
    replaceLastTextPart(messageId: string, text: string): void;

    addToolCallPart(messageId: string, part: ToolCallPart): void;
    updateToolCallStatus(
        messageId: string,
        toolCallId: string,
        status: ToolCallStatus,
    ): void;
    addToolResultPart(messageId: string, part: ToolResultPart): void;

    addSources(sources: Source[]): void;
    setContextItems(items: SerializedContextItems): void;
    setLastModelId(id: ModelId | null): void;

    /** Replaces the entire session — typically on file load. */
    replaceSession(next: Session): void;
}

/**
 * Phase 2 centralized session state. Replaces the per-signal state previously
 * scattered across `useChatController` (messages, sources, lastSourceLinkNumber)
 * with a single Solid store driven by named actions. Solid's fine-grained
 * reactivity means downstream readers only re-run on the slice they touched.
 */
export function createSessionStore(initial: Session): SessionStore {
    const [session, setSession] = createStore<Session>(initial);

    const touch = (now: number = Date.now()) => setSession("updatedAt", now);
    const newId = () => crypto.randomUUID();

    return {
        session,

        appendUserMessage(text, now = Date.now()) {
            const id = newId();
            setSession(
                "messages",
                session.messages.length,
                {
                    id,
                    role: "user",
                    createdAt: now,
                    parts: [{ type: "text", text }],
                },
            );
            touch(now);
            return id;
        },

        beginAssistantMessage(now = Date.now()) {
            const id = newId();
            setSession("messages", session.messages.length, {
                id,
                role: "assistant",
                createdAt: now,
                parts: [],
            });
            touch(now);
            return id;
        },

        appendAssistantText(messageId, text) {
            setSession(
                "messages",
                (m) => m.id === messageId,
                produce((message) => {
                    const last = message.parts[message.parts.length - 1];
                    if (last && last.type === "text") {
                        last.text += text;
                    } else {
                        message.parts.push({ type: "text", text });
                    }
                }),
            );
            touch();
        },

        replaceLastTextPart(messageId, text) {
            setSession(
                "messages",
                (m) => m.id === messageId,
                produce((message) => {
                    for (let i = message.parts.length - 1; i >= 0; i--) {
                        if (message.parts[i].type === "text") {
                            message.parts[i] = { type: "text", text };
                            return;
                        }
                    }
                    message.parts.push({ type: "text", text });
                }),
            );
            touch();
        },

        addToolCallPart(messageId, part) {
            setSession(
                "messages",
                (m) => m.id === messageId,
                "parts",
                (parts) => [...parts, part],
            );
            touch();
        },

        updateToolCallStatus(messageId, toolCallId, status) {
            setSession(
                "messages",
                (m) => m.id === messageId,
                "parts",
                (parts) =>
                    parts.map((p) =>
                        p.type === "tool-call" && p.toolCallId === toolCallId
                            ? { ...p, status }
                            : p,
                    ),
            );
            touch();
        },

        addToolResultPart(messageId, part) {
            setSession(
                "messages",
                (m) => m.id === messageId,
                "parts",
                (parts) => [...parts, part],
            );
            touch();
        },

        addSources(sources) {
            if (sources.length === 0) return;
            setSession("sources", (cur) => [...cur, ...sources]);
            touch();
        },

        setContextItems(items) {
            setSession("contextItems", items);
            touch();
        },

        setLastModelId(id) {
            setSession("lastModelId", id);
            touch();
        },

        replaceSession(next) {
            setSession(next);
        },
    };
}
