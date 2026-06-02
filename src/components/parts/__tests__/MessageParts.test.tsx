import { describe, expect, it } from "vitest";
import { fireEvent, render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { PluginContext } from "@/CoiChatApp";
import { createPermissionBroker } from "@/agent/permission-broker";
import type { CoIntelligencePlugin } from "@/CoIntelligencePlugin";
import { MessageParts } from "@/components/parts/MessageParts";

function makePluginWithBroker(): {
    plugin: CoIntelligencePlugin;
    broker: ReturnType<typeof createPermissionBroker>;
} {
    let broker!: ReturnType<typeof createPermissionBroker>;
    createRoot(() => {
        broker = createPermissionBroker();
    });
    const plugin = {
        permissionBroker: broker,
    } as unknown as CoIntelligencePlugin;
    return { plugin, broker };
}

describe("MessageParts router — approval flow", () => {
    it("renders the ApprovalPrompt while the broker has a matching pending entry", async () => {
        const { plugin, broker } = makePluginWithBroker();
        void broker.requestApproval({
            toolCallId: "c1",
            toolName: "edit_note",
            input: { path: "Foo.md" },
        });
        const { container } = render(() => (
            <PluginContext.Provider value={plugin}>
                <MessageParts
                    parts={[
                        {
                            type: "tool-call",
                            toolCallId: "c1",
                            toolName: "edit_note",
                            input: { path: "Foo.md" },
                            status: "running",
                        },
                    ]}
                />
            </PluginContext.Provider>
        ));
        expect(container.querySelector(".coi-approval-prompt")).not.toBeNull();
        expect(container.querySelector(".coi-tool-card")).toBeNull();
    });

    it("swaps to the static tool-call card once the broker resolves", async () => {
        const { plugin, broker } = makePluginWithBroker();
        void broker.requestApproval({
            toolCallId: "c1",
            toolName: "edit_note",
            input: { path: "Foo.md" },
        });
        const { container, getByText } = render(() => (
            <PluginContext.Provider value={plugin}>
                <MessageParts
                    parts={[
                        {
                            type: "tool-call",
                            toolCallId: "c1",
                            toolName: "edit_note",
                            input: { path: "Foo.md" },
                            status: "running",
                        },
                    ]}
                />
            </PluginContext.Provider>
        ));
        fireEvent.click(getByText("Allow"));
        expect(container.querySelector(".coi-approval-prompt")).toBeNull();
        expect(container.querySelector(".coi-tool-card")).not.toBeNull();
    });

    it("renders the static card when no broker entry matches the toolCallId", () => {
        const { plugin } = makePluginWithBroker();
        const { container } = render(() => (
            <PluginContext.Provider value={plugin}>
                <MessageParts
                    parts={[
                        {
                            type: "tool-call",
                            toolCallId: "c-no-match",
                            toolName: "read_note",
                            input: { path: "Foo.md" },
                            status: "success",
                        },
                    ]}
                />
            </PluginContext.Provider>
        ));
        expect(container.querySelector(".coi-tool-card")).not.toBeNull();
        expect(container.querySelector(".coi-approval-prompt")).toBeNull();
    });
});
