import { describe, expect, it } from "vitest";
import { render } from "@solidjs/testing-library";

import { ToolCallCard } from "@/components/parts/ToolCallCard";
import { ToolResultCard } from "@/components/parts/ToolResultCard";

describe("ToolCallCard", () => {
    it("renders tool name + status pill + pretty-printed args", () => {
        const { container } = render(() => (
            <ToolCallCard
                part={{
                    type: "tool-call",
                    toolCallId: "1",
                    toolName: "read_note",
                    input: { path: "Foo.md" },
                    status: "running",
                }}
            />
        ));
        const summary = container.querySelector(".coi-tool-card-summary");
        expect(summary?.textContent).toContain("read_note");
        expect(summary?.textContent).toContain("running");
        expect(container.querySelector(".coi-tool-card-body")?.textContent).toBe(
            '{\n  "path": "Foo.md"\n}',
        );
    });

    it("attaches the status as a CSS class so styling can vary by lifecycle", () => {
        const { container } = render(() => (
            <ToolCallCard
                part={{
                    type: "tool-call",
                    toolCallId: "1",
                    toolName: "x",
                    input: {},
                    status: "denied",
                }}
            />
        ));
        expect(container.querySelector(".coi-tool-status-denied")).not.toBeNull();
    });

    it("omits the body when there are no args", () => {
        const { container } = render(() => (
            <ToolCallCard
                part={{
                    type: "tool-call",
                    toolCallId: "1",
                    toolName: "ping",
                    input: {},
                    status: "success",
                }}
            />
        ));
        expect(container.querySelector(".coi-tool-card-body")).toBeNull();
    });
});

describe("ToolResultCard", () => {
    it("renders a string output verbatim", () => {
        const { container } = render(() => (
            <ToolResultCard
                part={{
                    type: "tool-result",
                    toolCallId: "1",
                    toolName: "read_note",
                    output: "hello",
                }}
            />
        ));
        expect(container.querySelector(".coi-tool-card-body")?.textContent).toBe(
            "hello",
        );
    });

    it("JSON-pretty-prints object outputs", () => {
        const { container } = render(() => (
            <ToolResultCard
                part={{
                    type: "tool-result",
                    toolCallId: "1",
                    toolName: "list_folder",
                    output: { count: 3 },
                }}
            />
        ));
        expect(container.querySelector(".coi-tool-card-body")?.textContent).toBe(
            '{\n  "count": 3\n}',
        );
    });

    it("renders edit_note diffs via DiffView instead of raw JSON", () => {
        const { container } = render(() => (
            <ToolResultCard
                part={{
                    type: "tool-result",
                    toolCallId: "1",
                    toolName: "edit_note",
                    output: {
                        path: "a.md",
                        replacements: 1,
                        diff: "--- a.md\n+++ a.md\n-old\n+new",
                    },
                }}
            />
        ));
        expect(container.querySelector(".coi-diff")).not.toBeNull();
        expect(container.querySelector(".coi-tool-card-body")).toBeNull();
    });

    it("opens by default and tags errors visually", () => {
        const { container } = render(() => (
            <ToolResultCard
                part={{
                    type: "tool-result",
                    toolCallId: "1",
                    toolName: "edit_note",
                    output: "boom",
                    isError: true,
                }}
            />
        ));
        const details = container.querySelector(
            ".coi-tool-card.coi-tool-result.is-error",
        ) as HTMLDetailsElement | null;
        expect(details).not.toBeNull();
        expect(details?.open).toBe(true);
    });
});
