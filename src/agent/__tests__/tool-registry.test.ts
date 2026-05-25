import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { createToolRegistry } from "@/agent/tool-registry";
import type { CoiTool } from "@/agent/types";

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
        const registry = createToolRegistry();
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
            { toolCallId: "call-1", abortSignal },
        );
    });

    it("toAiSdkTools forwards requiresApproval as needsApproval", () => {
        const registry = createToolRegistry();
        registry.register(makeTool({ name: "destructive", requiresApproval: true }));
        registry.register(makeTool({ name: "safe", requiresApproval: false }));
        const set = registry.toAiSdkTools();
        expect((set.destructive as { needsApproval?: boolean }).needsApproval).toBe(true);
        expect((set.safe as { needsApproval?: boolean }).needsApproval).toBe(false);
    });
});
