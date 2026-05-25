import type { z } from "zod";

export type ToolScope = "vault" | "web" | "mcp";

export type ToolPlatform = "desktop" | "mobile";

/**
 * Context passed to a tool's execute function. Will grow over time (app handle,
 * plugin handle, working directory, etc.) — kept minimal for Phase 1.
 */
export interface ToolExecutionContext {
    toolCallId: string;
    abortSignal?: AbortSignal;
}

/**
 * A Co-Intelligence tool definition. Wraps an AI SDK tool with metadata the
 * registry uses for platform/scope filtering and the permission broker uses
 * for approval routing.
 */
export interface CoiTool<INPUT = unknown, OUTPUT = unknown> {
    name: string;
    description: string;
    inputSchema: z.ZodType<INPUT>;
    execute: (
        input: INPUT,
        ctx: ToolExecutionContext,
    ) => OUTPUT | Promise<OUTPUT>;
    requiresApproval: boolean;
    scope: ToolScope;
    platforms: ToolPlatform[];
}

/**
 * Normalized event emitted by the agent loop. Replaces direct iteration over
 * the AI SDK fullStream so callers (useChatController, future tool/approval UI)
 * see a stable shape.
 */
export type AgentEvent =
    | { type: "text"; text: string }
    | { type: "reasoning-start" }
    | { type: "reasoning-delta"; text: string }
    | { type: "reasoning-end" }
    | {
          type: "tool-call";
          toolCallId: string;
          toolName: string;
          input: unknown;
      }
    | { type: "tool-input-delta"; toolCallId: string; delta: string }
    | {
          type: "tool-result";
          toolCallId: string;
          toolName: string;
          output: unknown;
      }
    | {
          type: "tool-error";
          toolCallId: string;
          toolName: string;
          error: unknown;
      }
    | {
          type: "approval-requested";
          approvalId: string;
          toolCallId: string;
          toolName: string;
          input: unknown;
      }
    | {
          type: "finish-step";
          finishReason: string;
      }
    | { type: "finish"; finishReason: string }
    | { type: "error"; error: unknown };
