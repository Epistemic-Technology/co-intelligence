import { tool as aiTool, type ToolSet } from "ai";
import type { CoiTool, ToolPlatform, ToolScope } from "@/agent/types";

export interface ToolRegistryFilter {
    platform?: ToolPlatform;
    scope?: ToolScope;
}

export interface ToolRegistry {
    register(tool: CoiTool): void;
    has(name: string): boolean;
    get(name: string): CoiTool | undefined;
    list(filter?: ToolRegistryFilter): CoiTool[];
    /**
     * Converts the matching tools into the AI SDK `ToolSet` shape that
     * `streamText` accepts. The execute wrapper forwards the AI SDK's
     * toolCallId / abortSignal to the Coi tool.
     */
    toAiSdkTools(filter?: ToolRegistryFilter): ToolSet;
}

/**
 * Creates an empty tool registry. Append-only: re-registering an existing name
 * throws to surface accidental collisions early.
 */
export function createToolRegistry(): ToolRegistry {
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
            tools.set(t.name, t);
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
        toAiSdkTools(filter) {
            const out: ToolSet = {};
            for (const t of filtered(filter)) {
                out[t.name] = aiTool({
                    description: t.description,
                    inputSchema: t.inputSchema as never,
                    needsApproval: t.requiresApproval,
                    execute: (async (
                        input: unknown,
                        opts: {
                            toolCallId: string;
                            abortSignal?: AbortSignal;
                        },
                    ) =>
                        t.execute(input as never, {
                            toolCallId: opts.toolCallId,
                            abortSignal: opts.abortSignal,
                        })) as never,
                });
            }
            return out;
        },
    };
}
