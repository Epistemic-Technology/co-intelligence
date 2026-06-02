import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@solidjs/testing-library";

import { ApprovalPrompt } from "@/components/parts/ApprovalPrompt";

function makeRequest(input: unknown = { path: "Foo.md" }) {
    return {
        toolCallId: "c1",
        toolName: "edit_note",
        input,
        resolve: vi.fn(),
    };
}

describe("ApprovalPrompt", () => {
    it("renders tool name and pretty-printed args", () => {
        const { container } = render(() => (
            <ApprovalPrompt
                request={makeRequest()}
                onDecide={() => {}}
            />
        ));
        expect(
            container.querySelector(".coi-approval-prompt-title")?.textContent,
        ).toContain("edit_note");
        expect(
            container.querySelector(".coi-approval-prompt-args")?.textContent,
        ).toBe('{\n  "path": "Foo.md"\n}');
    });

    it("omits the args block when input is empty", () => {
        const { container } = render(() => (
            <ApprovalPrompt
                request={makeRequest({})}
                onDecide={() => {}}
            />
        ));
        expect(
            container.querySelector(".coi-approval-prompt-args"),
        ).toBeNull();
    });

    it("Allow / Deny / Always pass the matching decision", () => {
        const onDecide = vi.fn();
        const { getByText } = render(() => (
            <ApprovalPrompt request={makeRequest()} onDecide={onDecide} />
        ));
        fireEvent.click(getByText("Allow"));
        fireEvent.click(getByText("Deny"));
        fireEvent.click(getByText("Always allow"));
        expect(onDecide.mock.calls.map((c) => c[0])).toEqual([
            "allow",
            "deny",
            "always",
        ]);
    });
});
