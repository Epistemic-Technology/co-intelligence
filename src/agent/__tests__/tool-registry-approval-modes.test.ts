import { describe, expect, it, vi } from "vitest";
import { App } from "obsidian";
import { createRoot } from "solid-js";
import { z } from "zod";

import {
    createToolRegistry,
    ToolApprovalDeniedError,
} from "@/agent/tool-registry";
import { createPermissionBroker } from "@/agent/permission-broker";
import type CoIntelligencePlugin from "@/CoIntelligencePlugin";
import type { CoiTool, ToolDependencies } from "@/agent/types";

function makeDeps(): ToolDependencies {
    return {
        app: new App(),
        plugin: {} as CoIntelligencePlugin,
    };
}

function makeWriteTool(execute = vi.fn(async () => "ok")): CoiTool {
    return {
        name: "edit_note",
        description: "writes",
        inputSchema: z.object({}),
        execute: execute as never,
        requiresApproval: true,
        scope: "vault",
        platforms: ["desktop", "mobile"],
    };
}

describe("toAiSdkTools approvalMode", () => {
    it("auto mode skips the broker and runs immediately", async () => {
        const execute = vi.fn(async () => "ran");
        const registry = createToolRegistry(makeDeps());
        registry.register(makeWriteTool(execute));
        const { broker, result } = await new Promise<{
            broker: ReturnType<typeof createPermissionBroker>;
            result: unknown;
        }>((resolve) => {
            createRoot(() => {
                const broker = createPermissionBroker();
                const tools = registry.toAiSdkTools({
                    permissionBroker: broker,
                    approvalMode: "auto",
                });
                void (
                    tools.edit_note.execute as unknown as (
                        i: unknown,
                        o: { toolCallId: string },
                    ) => Promise<unknown>
                )({}, { toolCallId: "c1" }).then((res) =>
                    resolve({ broker, result: res }),
                );
            });
        });
        expect(result).toBe("ran");
        expect(broker.pending()).toEqual([]);
        expect(execute).toHaveBeenCalledOnce();
    });

    it("readonly mode throws ToolApprovalDeniedError without prompting", async () => {
        const execute = vi.fn(async () => "ran");
        const registry = createToolRegistry(makeDeps());
        registry.register(makeWriteTool(execute));
        const error = await new Promise<unknown>((resolve) => {
            createRoot(() => {
                const broker = createPermissionBroker();
                const tools = registry.toAiSdkTools({
                    permissionBroker: broker,
                    approvalMode: "readonly",
                });
                (
                    tools.edit_note.execute as unknown as (
                        i: unknown,
                        o: { toolCallId: string },
                    ) => Promise<unknown>
                )({}, { toolCallId: "c1" }).then(
                    () => resolve(new Error("did not throw")),
                    (err) => resolve(err),
                );
            });
        });
        expect(error).toBeInstanceOf(ToolApprovalDeniedError);
        expect(execute).not.toHaveBeenCalled();
    });

    it("ask mode (default) still goes through the broker", async () => {
        const execute = vi.fn(async () => "ran");
        const registry = createToolRegistry(makeDeps());
        registry.register(makeWriteTool(execute));
        const result = await new Promise<unknown>((resolve) => {
            createRoot(() => {
                const broker = createPermissionBroker();
                const tools = registry.toAiSdkTools({
                    permissionBroker: broker,
                    approvalMode: "ask",
                });
                const pending = (
                    tools.edit_note.execute as unknown as (
                        i: unknown,
                        o: { toolCallId: string },
                    ) => Promise<unknown>
                )({}, { toolCallId: "c1" });
                queueMicrotask(() => {
                    broker.resolve("c1", "allow");
                    void pending.then((res) => resolve(res));
                });
            });
        });
        expect(result).toBe("ran");
        expect(execute).toHaveBeenCalledOnce();
    });

    it("readonly does not affect approval-not-required tools", async () => {
        const readTool: CoiTool = {
            name: "read_note",
            description: "reads",
            inputSchema: z.object({}),
            execute: (async () => "ok") as never,
            requiresApproval: false,
            scope: "vault",
            platforms: ["desktop", "mobile"],
        };
        const registry = createToolRegistry(makeDeps());
        registry.register(readTool);
        const tools = registry.toAiSdkTools({ approvalMode: "readonly" });
        const result = await (
            tools.read_note.execute as unknown as (
                i: unknown,
                o: { toolCallId: string },
            ) => Promise<unknown>
        )({}, { toolCallId: "c1" });
        expect(result).toBe("ok");
    });
});
