import { describe, expect, it } from "vitest";
import { render } from "@solidjs/testing-library";

import { DiffView } from "@/components/parts/DiffView";

describe("DiffView", () => {
    it("classifies headers, adds, removes, and context lines", () => {
        const diff = [
            "--- a.md",
            "+++ a.md",
            " context",
            "-removed",
            "+added",
        ].join("\n");
        const { container } = render(() => <DiffView diff={diff} />);
        const lines = container.querySelectorAll(".coi-diff-line");
        expect(lines).toHaveLength(5);
        expect(lines[0].classList.contains("coi-diff-header")).toBe(true);
        expect(lines[1].classList.contains("coi-diff-header")).toBe(true);
        expect(lines[2].classList.contains("coi-diff-context")).toBe(true);
        expect(lines[3].classList.contains("coi-diff-removed")).toBe(true);
        expect(lines[4].classList.contains("coi-diff-added")).toBe(true);
    });

    it("strips the leading marker char from the rendered text", () => {
        const { container } = render(() => (
            <DiffView diff="+hello" />
        ));
        const text = container.querySelector(".coi-diff-text");
        expect(text?.textContent).toBe("hello");
    });
});
