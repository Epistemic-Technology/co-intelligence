import type { ModelId, Source } from "@/types";

/**
 * Bumped whenever the on-disk Session shape changes. Sidecar reads compare
 * against this and run a migration when the stored version is lower.
 */
export const SESSION_FILE_VERSION = 1;

export type SessionMessageRole = "user" | "assistant" | "system";

/**
 * Lifecycle of a tool-call message part. The agent loop drives transitions:
 * pending → awaiting-approval (if needsApproval) → running → success/error/denied.
 */
export type ToolCallStatus =
    | "pending"
    | "awaiting-approval"
    | "running"
    | "success"
    | "error"
    | "denied";

/**
 * A single piece of a {@link SessionMessage}. Mirrors AI SDK v6's UIMessage
 * parts shape so the agent loop's AgentEvent stream maps cleanly onto parts.
 */
export type MessagePart =
    | { type: "text"; text: string }
    | { type: "reasoning"; text: string }
    | {
          type: "tool-call";
          toolCallId: string;
          toolName: string;
          input: unknown;
          status: ToolCallStatus;
      }
    | {
          type: "tool-result";
          toolCallId: string;
          toolName: string;
          output: unknown;
          isError?: boolean;
      }
    | {
          type: "attachment";
          id: string;
          mimeType: string;
          name?: string;
          url?: string;
      };

export interface SessionMessage {
    id: string;
    role: SessionMessageRole;
    parts: MessagePart[];
    /** Unix ms. */
    createdAt: number;
}

/**
 * Context items in serialized form. Vault TFiles can't go in JSON, so we store
 * note paths and re-resolve at load time.
 */
export interface SerializedContextItems {
    notes: string[];
    tags: string[];
    sources: Source[];
}

/**
 * The session as it lives on disk in the JSON sidecar. Source of truth for
 * tool calls, parts, approvals, and step history. The markdown note body is a
 * human-readable view regenerated from this.
 */
/**
 * How the controller handles tools that declare `requiresApproval: true`.
 *
 * - `ask`: surface the approval card and wait for the user (default).
 * - `auto`: skip the prompt and run the tool immediately. Use when you
 *   trust the agent and want it to keep moving.
 * - `readonly`: refuse approval-required tools without prompting. Read-only
 *   tools still work, so the agent can still answer questions about the
 *   vault but can't modify anything.
 */
export type ApprovalMode = "ask" | "auto" | "readonly";

export interface SessionSettings {
    /** Hard ceiling on agent-loop steps for this session. */
    maxSteps?: number;
    approvalMode?: ApprovalMode;
}

export interface Session {
    id: string;
    version: number;
    /** Unix ms. */
    createdAt: number;
    /** Unix ms. */
    updatedAt: number;
    messages: SessionMessage[];
    contextItems: SerializedContextItems;
    sources: Source[];
    lastModelId: ModelId | null;
    /** Per-session overrides. Missing fields fall back to plugin defaults. */
    settings?: SessionSettings;
}

/**
 * Returns a new empty Session. Caller supplies the id (typically a UUID
 * generated alongside the markdown note's `coi-session-id` frontmatter).
 */
export function createEmptySession(id: string, now: number = Date.now()): Session {
    return {
        id,
        version: SESSION_FILE_VERSION,
        createdAt: now,
        updatedAt: now,
        messages: [],
        contextItems: { notes: [], tags: [], sources: [] },
        sources: [],
        lastModelId: null,
    };
}

/**
 * Concatenates the text parts of a message into a single string. Reasoning,
 * tool calls, and attachments are skipped. Used for legacy compatibility
 * (title generation, plain-text rendering, etc.).
 */
export function messageText(message: SessionMessage): string {
    return message.parts
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("");
}

/**
 * Converts Session messages into the AI SDK's ModelChatMessage shape for
 * outgoing requests. Phase 2 stub: collapses each session message into its
 * concatenated text. Tool calls / results / attachments are dropped here
 * — Phase 3+ will round-trip them through proper AI SDK message parts when
 * the first tools land.
 */
export function sessionMessagesToModelMessages(
    messages: SessionMessage[],
): Array<{ role: "user" | "assistant"; content: string }> {
    return messages
        .filter(
            (m): m is SessionMessage & { role: "user" | "assistant" } =>
                m.role === "user" || m.role === "assistant",
        )
        .map((m) => ({ role: m.role, content: messageText(m) }));
}
