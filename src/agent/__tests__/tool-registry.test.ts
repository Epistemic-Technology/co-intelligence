import { describe, it, expect, vi } from "vitest";
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

function makeTool(
    overrides: Partial<CoiTool<unknown, unknown>> & { name: string },
): CoiTool {
    return {
        description: "test tool",
        inputSchema: z.object({}),
        execute: async () => null,
        requiresApproval: false,
        scope: "vault",
        platforms: ["desktop", "mobile"],
        ...overrides,
    };
}

describe("createToolRegistry", () => {
    it("starts empty", () => {
        const registry = createToolRegistry();
        expect(registry.list()).toEqual([]);
        expect(registry.has("anything")).toBe(false);
        expect(registry.get("anything")).toBeUndefined();
    });

    it("registers and retrieves tools by name", () => {
        const registry = createToolRegistry();
        const tool = makeTool({ name: "read_note" });
        registry.register(tool);
        expect(registry.has("read_note")).toBe(true);
        expect(registry.get("read_note")).toBe(tool);
        expect(registry.list()).toEqual([tool]);
    });

    it("throws on duplicate registration", () => {
        const registry = createToolRegistry();
        registry.register(makeTool({ name: "read_note" }));
        expect(() =>
            registry.register(makeTool({ name: "read_note" })),
        ).toThrow(/already registered/);
    });

    it("filters by platform", () => {
        const registry = createToolRegistry();
        registry.register(
            makeTool({ name: "desktop_only", platforms: ["desktop"] }),
        );
        registry.register(
            makeTool({ name: "mobile_only", platforms: ["mobile"] }),
        );
        registry.register(
            makeTool({ name: "both", platforms: ["desktop", "mobile"] }),
        );
        const mobile = registry.list({ platform: "mobile" }).map((t) => t.name);
        expect(mobile.sort()).toEqual(["both", "mobile_only"]);
    });

    it("filters by scope", () => {
        const registry = createToolRegistry();
        registry.register(makeTool({ name: "vault_a", scope: "vault" }));
        registry.register(makeTool({ name: "web_a", scope: "web" }));
        const vault = registry.list({ scope: "vault" }).map((t) => t.name);
        expect(vault).toEqual(["vault_a"]);
    });

    it("toAiSdkTools converts every registered tool", () => {
        const registry = createToolRegistry();
        registry.register(makeTool({ name: "a" }));
        registry.register(makeTool({ name: "b" }));
        const set = registry.toAiSdkTools();
        expect(Object.keys(set).sort()).toEqual(["a", "b"]);
    });

    it("toAiSdkTools respects the platform filter", () => {
        const registry = createToolRegistry();
        registry.register(
            makeTool({ name: "desktop_only", platforms: ["desktop"] }),
        );
        registry.register(makeTool({ name: "both" }));
        const set = registry.toAiSdkTools({ platform: "mobile" });
        expect(Object.keys(set)).toEqual(["both"]);
    });

    it("toAiSdkTools wraps execute to receive toolCallId + abortSignal", async () => {
        const deps = makeDeps();
        const registry = createToolRegistry(deps);
        const execute = vi.fn(async () => "ok");
        registry.register(
            makeTool({ name: "echo", execute: execute as never }),
        );
        const set = registry.toAiSdkTools();
        const abortSignal = new AbortController().signal;
        const result = await (
            set.echo.execute as unknown as (
                input: unknown,
                opts: { toolCallId: string; abortSignal: AbortSignal },
            ) => Promise<unknown>
        )({ q: 1 }, { toolCallId: "call-1", abortSignal });
        expect(result).toBe("ok");
        expect(execute).toHaveBeenCalledWith(
            { q: 1 },
            { ...deps, toolCallId: "call-1", abortSignal },
        );
    });

    it("approval-required tools call the broker before executing", async () => {
        const registry = createToolRegistry(makeDeps());
        const execute = vi.fn(async () => "ran");
        registry.register(
            makeTool({
                name: "edit_note",
                requiresApproval: true,
                execute: execute as never,
            }),
        );
        const { result, broker } = await new Promise<{
            result: unknown;
            broker: ReturnType<typeof createPermissionBroker>;
        }>((resolve) => {
            createRoot(() => {
                const broker = createPermissionBroker();
                const set = registry.toAiSdkTools({ permissionBroker: broker });
                const pending = (
                    set.edit_note.execute as unknown as (
                        input: unknown,
                        opts: { toolCallId: string },
                    ) => Promise<unknown>
                )({ path: "a.md" }, { toolCallId: "c1" });
                queueMicrotask(() => {
                    broker.resolve("c1", "allow");
                    void pending.then((result) => resolve({ result, broker }));
                });
            });
        });
        expect(result).toBe("ran");
        expect(execute).toHaveBeenCalledOnce();
        expect(broker.pending()).toEqual([]);
    });

    it("approval-required tools throw when broker denies", async () => {
        const registry = createToolRegistry(makeDeps());
        const execute = vi.fn(async () => "ran");
        registry.register(
            makeTool({
                name: "edit_note",
                requiresApproval: true,
                execute: execute as never,
            }),
        );
        const error = await new Promise<unknown>((resolve) => {
            createRoot(() => {
                const broker = createPermissionBroker();
                const set = registry.toAiSdkTools({ permissionBroker: broker });
                const pending = (
                    set.edit_note.execute as unknown as (
                        input: unknown,
                        opts: { toolCallId: string },
                    ) => Promise<unknown>
                )({}, { toolCallId: "c1" });
                queueMicrotask(() => {
                    broker.resolve("c1", "deny");
                    pending.then(
                        () => resolve(new Error("did not throw")),
                        (err) => resolve(err),
                    );
                });
            });
        });
        expect(error).toBeInstanceOf(ToolApprovalDeniedError);
        expect(execute).not.toHaveBeenCalled();
    });

    it("approval-required tools run unconditionally when no broker is provided", async () => {
        const registry = createToolRegistry(makeDeps());
        const execute = vi.fn(async () => "ran");
        registry.register(
            makeTool({
                name: "edit_note",
                requiresApproval: true,
                execute: execute as never,
            }),
        );
        const set = registry.toAiSdkTools();
        const result = await (
            set.edit_note.execute as unknown as (
                input: unknown,
                opts: { toolCallId: string },
            ) => Promise<unknown>
        )({}, { toolCallId: "c1" });
        expect(result).toBe("ran");
        expect(execute).toHaveBeenCalledOnce();
    });

    it("approval-not-required tools bypass the broker", async () => {
        const registry = createToolRegistry(makeDeps());
        const execute = vi.fn(async () => "ran");
        registry.register(
            makeTool({
                name: "read_note",
                requiresApproval: false,
                execute: execute as never,
            }),
        );
        const { result, broker } = await new Promise<{
            result: unknown;
            broker: ReturnType<typeof createPermissionBroker>;
        }>((resolve) => {
            createRoot(() => {
                const broker = createPermissionBroker();
                const set = registry.toAiSdkTools({ permissionBroker: broker });
                void (
                    set.read_note.execute as unknown as (
                        input: unknown,
                        opts: { toolCallId: string },
                    ) => Promise<unknown>
                )({}, { toolCallId: "c1" }).then((result) =>
                    resolve({ result, broker }),
                );
            });
        });
        expect(result).toBe("ran");
        expect(broker.pending()).toEqual([]);
    });
});
