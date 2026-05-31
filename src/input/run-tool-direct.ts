import { Notice, type App } from "obsidian";

import type { CoIntelligencePlugin } from "@/CoIntelligencePlugin";
import type { PermissionBroker } from "@/agent/permission-broker";
import type { CoiTool } from "@/agent/types";
import type { SessionStore } from "@/session/session-store";

export interface RunToolDirectParams {
    tool: CoiTool;
    /** Raw text after the tool name on the slash line. */
    rawArgs: string;
    app: App;
    plugin: CoIntelligencePlugin;
    store: SessionStore;
    permissionBroker?: PermissionBroker;
}

/**
 * Invokes `tool` directly from a slash command, bypassing the model. Wraps
 * the call in a synthetic user message + assistant tool-call / tool-result
 * pair so the chat history shows what happened the same way a model-driven
 * tool call would. Approval-required tools still route through the broker —
 * power users wanting to skip the modal can grant a standing approval.
 *
 * Args parsing: empty string → empty object; otherwise the string is parsed
 * as JSON and validated against the tool's input schema. Bad JSON / shape
 * mismatches surface as Obsidian Notices without writing to the session.
 */
export async function runToolDirect(
    params: RunToolDirectParams,
): Promise<void> {
    const { tool, rawArgs, app, plugin, store, permissionBroker } = params;

    const parsed = parseAndValidateArgs(tool, rawArgs);
    if (!parsed.ok) {
        new Notice(`/${tool.name}: ${parsed.message}`);
        return;
    }

    store.appendUserMessage(
        rawArgs ? `/${tool.name} ${rawArgs}` : `/${tool.name}`,
    );
    const assistantId = store.beginAssistantMessage();
    const toolCallId = crypto.randomUUID();
    store.addToolCallPart(assistantId, {
        type: "tool-call",
        toolCallId,
        toolName: tool.name,
        input: parsed.input,
        status: tool.requiresApproval ? "awaiting-approval" : "running",
    });

    if (tool.requiresApproval && permissionBroker) {
        const decision = await permissionBroker.requestApproval({
            toolCallId,
            toolName: tool.name,
            input: parsed.input,
        });
        if (decision === "deny") {
            store.updateToolCallStatus(assistantId, toolCallId, "denied");
            store.addToolResultPart(assistantId, {
                type: "tool-result",
                toolCallId,
                toolName: tool.name,
                output: "Tool call denied by user",
                isError: true,
            });
            return;
        }
        store.updateToolCallStatus(assistantId, toolCallId, "running");
    }

    try {
        const output = await tool.execute(parsed.input as never, {
            app,
            plugin,
            toolCallId,
        });
        store.updateToolCallStatus(assistantId, toolCallId, "success");
        store.addToolResultPart(assistantId, {
            type: "tool-result",
            toolCallId,
            toolName: tool.name,
            output,
        });
    } catch (error) {
        store.updateToolCallStatus(assistantId, toolCallId, "error");
        store.addToolResultPart(assistantId, {
            type: "tool-result",
            toolCallId,
            toolName: tool.name,
            output: (error as Error)?.message ?? String(error),
            isError: true,
        });
    }
}

type ArgsParse =
    | { ok: true; input: unknown }
    | { ok: false; message: string };

function parseAndValidateArgs(tool: CoiTool, rawArgs: string): ArgsParse {
    let raw: unknown;
    if (rawArgs === "") {
        raw = {};
    } else {
        try {
            raw = JSON.parse(rawArgs);
        } catch (error) {
            return {
                ok: false,
                message: `invalid JSON — ${(error as Error).message}`,
            };
        }
    }
    const validation = tool.inputSchema.safeParse(raw);
    if (!validation.success) {
        const first = validation.error.issues[0];
        const path = first?.path?.join(".") || "(root)";
        return {
            ok: false,
            message: `args don't match schema at ${path}: ${first?.message}`,
        };
    }
    return { ok: true, input: validation.data };
}
