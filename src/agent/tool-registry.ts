import { tool as aiTool, type ToolSet } from "ai";
import type {
    CoiTool,
    ToolDependencies,
    ToolPlatform,
    ToolScope,
} from "@/agent/types";
import type { PermissionBroker } from "@/agent/permission-broker";

export interface ToolRegistryFilter {
    platform?: ToolPlatform;
    scope?: ToolScope;
}

export type ApprovalMode = "ask" | "auto" | "readonly";

export interface ToAiSdkToolsOptions extends ToolRegistryFilter {
    /**
     * When set, approval-required tools are gated through the broker inside
     * the execute wrapper. A `"deny"` decision throws — surfaced to the model
     * as a `tool-error` event. Without a broker, approval-required tools run
     * unconditionally (intended only for tests / non-interactive contexts).
     */
    permissionBroker?: PermissionBroker;
    /**
     * Controls how the execute wrapper treats `requiresApproval: true` tools:
     * - `"ask"` (default): consult the broker.
     * - `"auto"`: skip the broker and run immediately.
     * - `"readonly"`: refuse without prompting (the model sees `tool-error`).
     */
    approvalMode?: ApprovalMode;
}

export interface ToolRegistry {
    register<I, O>(tool: CoiTool<I, O>): void;
    has(name: string): boolean;
    get(name: string): CoiTool | undefined;
    list(filter?: ToolRegistryFilter): CoiTool[];
    /**
     * Converts the matching tools into the AI SDK `ToolSet` shape that
     * `streamText` accepts. The execute wrapper forwards the AI SDK's
     * toolCallId / abortSignal to the Coi tool, and (when a broker is
     * supplied) gates approval-required tools before invoking the underlying
     * execute.
     */
    toAiSdkTools(options?: ToAiSdkToolsOptions): ToolSet;
}

/**
 * Thrown by the execute wrapper when the permission broker resolves an
 * approval-required tool call with `"deny"`. The AI SDK surfaces this as a
 * `tool-error` chunk; the controller then writes a denied tool-result part
 * into the session so the model can react in the next step.
 */
export class ToolApprovalDeniedError extends Error {
    constructor(toolName: string) {
        super(`Tool call "${toolName}" was denied by the user`);
        this.name = "ToolApprovalDeniedError";
    }
}

/**
 * Creates an empty tool registry. Append-only: re-registering an existing name
 * throws to surface accidental collisions early. The optional `dependencies`
 * are merged into every tool's execution context — pass them once at plugin
 * load so tool implementations don't need their own access to `app` / `plugin`.
 */
export function createToolRegistry(
    dependencies?: ToolDependencies,
): ToolRegistry {
    const tools = new Map<string, CoiTool>();

    const filtered = (filter?: ToolRegistryFilter): CoiTool[] => {
        const all = Array.from(tools.values());
        if (!filter) return all;
        return all.filter((t) => {
            if (filter.platform && !t.platforms.includes(filter.platform)) {
                return false;
            }
            if (filter.scope && t.scope !== filter.scope) {
                return false;
            }
            return true;
        });
    };

    return {
        register(t) {
            if (tools.has(t.name)) {
                throw new Error(`Tool "${t.name}" is already registered`);
            }
            tools.set(t.name, t as CoiTool);
        },
        has(name) {
            return tools.has(name);
        },
        get(name) {
            return tools.get(name);
        },
        list(filter) {
            return filtered(filter);
        },
        toAiSdkTools(options) {
            const { permissionBroker, approvalMode, ...filter } = options ?? {};
            const mode: ApprovalMode = approvalMode ?? "ask";
            const out: ToolSet = {};
            for (const t of filtered(filter)) {
                out[t.name] = aiTool({
                    description: t.description,
                    inputSchema: t.inputSchema as never,
                    execute: (async (
                        input: unknown,
                        opts: {
                            toolCallId: string;
                            abortSignal?: AbortSignal;
                        },
                    ) => {
                        if (t.requiresApproval) {
                            if (mode === "readonly") {
                                throw new ToolApprovalDeniedError(t.name);
                            }
                            if (mode === "ask" && permissionBroker) {
                                const decision =
                                    await permissionBroker.requestApproval({
                                        toolCallId: opts.toolCallId,
                                        toolName: t.name,
                                        input,
                                    });
                                if (decision === "deny") {
                                    throw new ToolApprovalDeniedError(t.name);
                                }
                            }
                        }
                        if (!dependencies) {
                            throw new Error(
                                `Tool "${t.name}" requires a registry with dependencies (app, plugin)`,
                            );
                        }
                        return t.execute(input as never, {
                            ...dependencies,
                            toolCallId: opts.toolCallId,
                            abortSignal: opts.abortSignal,
                        });
                    }) as never,
                });
            }
            return out;
        },
    };
}
