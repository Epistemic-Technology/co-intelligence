import type { MessagePart, Session, SessionMessage } from "@/session/types";

const CHAT_START = "<!-- CHAT-THREAD-START -->";
const CHAT_END = "<!-- CHAT-THREAD-END -->";
const CHAT_PATTERN = new RegExp(
    `${CHAT_START}[\\s\\S]*?${CHAT_END}`,
    "m",
);

/**
 * Renders a {@link Session} to the chat-section markdown body and splices it
 * into `noteContent` between the existing CHAT-THREAD-START / END markers.
 * Returns the input unchanged if the markers are missing — callers handle
 * inserting them on note creation.
 *
 * The sidecar is the source of truth: this markdown is for human reading,
 * search, git diffs, and portability. It is regenerated on every save.
 */
export function renderSessionIntoNote(
    noteContent: string,
    session: Session,
): string {
    if (!CHAT_PATTERN.test(noteContent)) {
        return noteContent;
    }
    const chatSection = renderChatSection(session);
    return noteContent.replace(CHAT_PATTERN, chatSection);
}

/**
 * Renders the markdown that goes between CHAT-THREAD-START / END. Exported for
 * direct testing.
 */
export function renderChatSection(session: Session): string {
    const messages = session.messages
        .map(renderMessage)
        .filter((s) => s.length > 0)
        .join("\n\n");

    const sources = renderSources(session.sources);
    const body = sources ? `${messages}\n\n${sources}` : messages;
    return `${CHAT_START}\n${body}\n${CHAT_END}`;
}

function renderMessage(message: SessionMessage): string {
    if (message.role === "system") return "";
    const parts = message.parts
        .map(renderPart)
        .filter((s) => s.length > 0)
        .join("\n\n");
    if (parts.length === 0) return "";
    return `## ${message.role}:\n\n${parts}`;
}

function renderPart(part: MessagePart): string {
    switch (part.type) {
        case "text":
            return bumpHeaders(part.text.trim());
        case "reasoning":
            return `<think>\n${part.text.trim()}\n</think>`;
        case "tool-call":
            return renderToolCall(part);
        case "tool-result":
            return renderToolResult(part);
        case "attachment":
            return renderAttachment(part);
    }
}

function renderToolCall(
    part: Extract<MessagePart, { type: "tool-call" }>,
): string {
    const title = `tool-call: ${part.toolName} (${part.status})`;
    const input = "```json\n" + safeJson(part.input) + "\n```";
    return calloutBlock("info", title, input);
}

function renderToolResult(
    part: Extract<MessagePart, { type: "tool-result" }>,
): string {
    const kind = part.isError ? "error" : "success";
    const title = `tool-result: ${part.toolName}`;
    const output = "```json\n" + safeJson(part.output) + "\n```";
    return calloutBlock(kind, title, output);
}

function renderAttachment(
    part: Extract<MessagePart, { type: "attachment" }>,
): string {
    const label = part.name || part.id;
    const meta = `${part.mimeType}${part.url ? ` — ${part.url}` : ""}`;
    return calloutBlock("note", `attachment: ${label}`, meta);
}

/**
 * Builds a collapsed Obsidian callout. The `-` suffix on the callout name
 * means collapsed-by-default, keeping the rendered note readable.
 */
function calloutBlock(kind: string, title: string, body: string): string {
    const lines = body.split("\n").map((line) => `> ${line}`);
    return [`> [!${kind}]- ${title}`, ...lines].join("\n");
}

function renderSources(
    sources: Session["sources"],
): string {
    if (sources.length === 0) return "";
    const items = sources
        .map(
            (source, index) =>
                `${index + 1}. [${source.title || source.url}](${source.url})`,
        )
        .join("\n");
    return `## Sources\n\n${items}`;
}

/**
 * Bumps the top-level header so user/assistant headers (`##`) always outrank
 * anything in message bodies. Mirrors the behavior of the legacy
 * serializeCoiNoteContent in src/utils/notes.ts.
 */
function bumpHeaders(content: string): string {
    const matches = content.match(/^#+/gm);
    if (!matches) return content;
    let minLevel = Infinity;
    for (const m of matches) minLevel = Math.min(minLevel, m.length);
    if (minLevel === 1) {
        return content.replace(/^(#+)/gm, (m) => m + "##");
    }
    if (minLevel === 2) {
        return content.replace(/^(#+)/gm, (m) => m + "#");
    }
    return content;
}

function safeJson(value: unknown): string {
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
}
