import { describe, it, expect } from "vitest";
import { createRoot } from "solid-js";
import { createPermissionBroker } from "@/agent/permission-broker";

function withRoot<T>(fn: () => T): T {
    let value: T;
    createRoot(() => {
        value = fn();
    });
    return value!;
}

describe("createPermissionBroker", () => {
    it("starts with no pending approvals or standing approvals", () => {
        withRoot(() => {
            const broker = createPermissionBroker();
            expect(broker.pending()).toEqual([]);
            expect(broker.hasStandingApproval("anything")).toBe(false);
        });
    });

    it("enqueues a pending approval when none is standing", async () => {
        withRoot(() => {
            const broker = createPermissionBroker();
            void broker.requestApproval({
                toolCallId: "c1",
                toolName: "edit_note",
                input: { path: "a.md" },
            });
            const queue = broker.pending();
            expect(queue).toHaveLength(1);
            expect(queue[0].toolName).toBe("edit_note");
            expect(queue[0].input).toEqual({ path: "a.md" });
        });
    });

    it("resolves with the user's decision", async () => {
        const promise = withRoot(() => {
            const broker = createPermissionBroker();
            const p = broker.requestApproval({
                toolCallId: "c1",
                toolName: "edit_note",
                input: {},
            });
            broker.resolve("c1", "allow");
            expect(broker.pending()).toEqual([]);
            return p;
        });
        await expect(promise).resolves.toBe("allow");
    });

    it("bypasses the queue when a standing approval exists", async () => {
        const promise = withRoot(() => {
            const broker = createPermissionBroker();
            broker.grantStandingApproval("read_note");
            const p = broker.requestApproval({
                toolCallId: "c1",
                toolName: "read_note",
                input: {},
            });
            expect(broker.pending()).toEqual([]);
            return p;
        });
        await expect(promise).resolves.toBe("allow");
    });

    it("resolving with 'always' grants a standing approval", async () => {
        const promise = withRoot(() => {
            const broker = createPermissionBroker();
            const p = broker.requestApproval({
                toolCallId: "c1",
                toolName: "edit_note",
                input: {},
            });
            broker.resolve("c1", "always");
            expect(broker.hasStandingApproval("edit_note")).toBe(true);
            return p;
        });
        await expect(promise).resolves.toBe("always");
    });

    it("resolve is a no-op for unknown toolCallIds", () => {
        withRoot(() => {
            const broker = createPermissionBroker();
            expect(() => broker.resolve("missing", "allow")).not.toThrow();
            expect(broker.pending()).toEqual([]);
        });
    });

    it("denyAll resolves every pending approval with 'deny'", async () => {
        const { p1, p2 } = withRoot(() => {
            const broker = createPermissionBroker();
            const p1 = broker.requestApproval({
                toolCallId: "c1",
                toolName: "a",
                input: {},
            });
            const p2 = broker.requestApproval({
                toolCallId: "c2",
                toolName: "b",
                input: {},
            });
            broker.denyAll();
            expect(broker.pending()).toEqual([]);
            return { p1, p2 };
        });
        await expect(p1).resolves.toBe("deny");
        await expect(p2).resolves.toBe("deny");
    });

    it("revokeStandingApproval removes a tool from the standing set", () => {
        withRoot(() => {
            const broker = createPermissionBroker();
            broker.grantStandingApproval("read_note");
            expect(broker.hasStandingApproval("read_note")).toBe(true);
            broker.revokeStandingApproval("read_note");
            expect(broker.hasStandingApproval("read_note")).toBe(false);
        });
    });

    it("clear empties both pending and standing approvals", async () => {
        const promise = withRoot(() => {
            const broker = createPermissionBroker();
            broker.grantStandingApproval("a");
            const p = broker.requestApproval({
                toolCallId: "c1",
                toolName: "b",
                input: {},
            });
            broker.clear();
            expect(broker.pending()).toEqual([]);
            expect(broker.hasStandingApproval("a")).toBe(false);
            return p;
        });
        await expect(promise).resolves.toBe("deny");
    });

    it("pending() reflects queue length between operations", () => {
        withRoot(() => {
            const broker = createPermissionBroker();
            expect(broker.pending().length).toBe(0);
            void broker.requestApproval({
                toolCallId: "c1",
                toolName: "a",
                input: {},
            });
            expect(broker.pending().length).toBe(1);
            void broker.requestApproval({
                toolCallId: "c2",
                toolName: "b",
                input: {},
            });
            expect(broker.pending().length).toBe(2);
            broker.resolve("c1", "allow");
            expect(broker.pending().length).toBe(1);
            broker.resolve("c2", "deny");
            expect(broker.pending().length).toBe(0);
        });
    });
});
