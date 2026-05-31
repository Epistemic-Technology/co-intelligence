import { describe, expect, it, vi } from "vitest";
import { App } from "obsidian";
import { createRoot } from "solid-js";
import { z } from "zod";

import { runToolDirect } from "@/input/run-tool-direct";
import { createPermissionBroker } from "@/agent/permission-broker";
import type { CoiTool } from "@/agent/types";
import type CoIntelligencePlugin from "@/CoIntelligencePlugin";
import { createSessionStore } from "@/session/session-store";
import { createEmptySession } from "@/session/types";

function makeTool(overrides: Partial<CoiTool> & { name: string }): CoiTool {
    return {
        description: "test",
        inputSchema: z.object({ path: z.string() }),
        execute: async () => ({ ok: true }),
        requiresApproval: false,
        scope: "vault",
        platforms: ["desktop", "mobile"],
        ...overrides,
    };
}

function makeContext() {
    const store = createSessionStore(createEmptySession("s", 0));
    const app = new App();
    const plugin = {} as CoIntelligencePlugin;
    return { store, app, plugin };
}

describe("runToolDirect", () => {
    it("writes a user message and tool-call/tool-result pair on success", async () => {
        const tool = makeTool({
            name: "read_note",
            execute: vi.fn().mockResolvedValue({ content: "hi" }),
        });
        const { store, app, plugin } = makeContext();
        await runToolDirect({
            tool,
            rawArgs: '{"path":"a.md"}',
            app,
            plugin,
            store,
        });
        const messages = store.session.messages;
        expect(messages).toHaveLength(2);
        expect(messages[0].role).toBe("user");
        const assistant = messages[1];
        const toolCall = assistant.parts.find((p) => p.type === "tool-call");
        const toolResult = assistant.parts.find(
            (p) => p.type === "tool-result",
        );
        expect(toolCall).toMatchObject({
            toolName: "read_note",
            status: "success",
        });
        expect(toolResult).toMatchObject({
            toolName: "read_note",
            output: { content: "hi" },
        });
    });

    it("surfaces invalid JSON args as a friendly error without touching the session", async () => {
        const tool = makeTool({ name: "read_note" });
        const { store, app, plugin } = makeContext();
        await runToolDirect({
            tool,
            rawArgs: "not-json",
            app,
            plugin,
            store,
        });
        expect(store.session.messages).toEqual([]);
    });

    it("surfaces schema mismatches without invoking execute", async () => {
        const execute = vi.fn();
        const tool = makeTool({ name: "read_note", execute });
        const { store, app, plugin } = makeContext();
        await runToolDirect({
            tool,
            rawArgs: '{"path":42}',
            app,
            plugin,
            store,
        });
        expect(execute).not.toHaveBeenCalled();
        expect(store.session.messages).toEqual([]);
    });

    it("records a tool-result with isError when execute throws", async () => {
        const tool = makeTool({
            name: "read_note",
            execute: vi
                .fn()
                .mockRejectedValue(new Error("boom")),
        });
        const { store, app, plugin } = makeContext();
        await runToolDirect({
            tool,
            rawArgs: '{"path":"a.md"}',
            app,
            plugin,
            store,
        });
        const assistant = store.session.messages[1];
        const result = assistant.parts.find((p) => p.type === "tool-result");
        expect(result).toMatchObject({ isError: true, output: "boom" });
        const call = assistant.parts.find((p) => p.type === "tool-call");
        expect(call).toMatchObject({ status: "error" });
    });

    it("denies the call when the permission broker rejects", async () => {
        const execute = vi.fn();
        const tool = makeTool({
            name: "edit_note",
            requiresApproval: true,
            execute,
        });
        const { store, app, plugin } = makeContext();
        await new Promise<void>((resolve) => {
            createRoot(() => {
                const broker = createPermissionBroker();
                const pending = runToolDirect({
                    tool,
                    rawArgs: '{"path":"a.md"}',
                    app,
                    plugin,
                    store,
                    permissionBroker: broker,
                });
                queueMicrotask(() => {
                    const queued = broker.pending();
                    expect(queued).toHaveLength(1);
                    broker.resolve(queued[0].toolCallId, "deny");
                    void pending.then(() => resolve());
                });
            });
        });
        expect(execute).not.toHaveBeenCalled();
        const assistant = store.session.messages[1];
        const call = assistant.parts.find((p) => p.type === "tool-call");
        expect(call).toMatchObject({ status: "denied" });
        const result = assistant.parts.find((p) => p.type === "tool-result");
        expect(result).toMatchObject({ isError: true });
    });
});
