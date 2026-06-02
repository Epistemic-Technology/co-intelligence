import type { App } from "obsidian";
import type { z } from "zod";

import type { CoIntelligencePlugin } from "@/CoIntelligencePlugin";

export type ToolScope = "vault" | "web" | "mcp";

export type ToolPlatform = "desktop" | "mobile";

/**
 * Dependencies a tool may need: Obsidian app handle for vault tools, plugin
 * handle for settings access. Bound at registry construction time and merged
 * into the per-call {@link ToolExecutionContext}, so individual tools don't
 * re-thread them through every call site.
 */
export interface ToolDependencies {
    app: App;
    plugin: CoIntelligencePlugin;
}

/**
 * Context passed to a tool's execute function. The `app` / `plugin` handles
 * come from {@link ToolDependencies}; `toolCallId` / `abortSignal` come from
 * the AI SDK execute wrapper for each call.
 */
export interface ToolExecutionContext extends ToolDependencies {
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
    /**
     * Zod schema validating the model's tool args. Declared as a three-arg
     * ZodType so schemas with `.default()` / `.optional()` (whose input and
     * output types differ) remain assignable.
     */
    inputSchema: z.ZodType<INPUT, z.ZodTypeDef, unknown>;
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
    | { type: "start-step" }
    | {
          type: "finish-step";
          finishReason: string;
      }
    | { type: "finish"; finishReason: string }
    | { type: "error"; error: unknown };
