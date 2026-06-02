import { describe, expect, it } from "vitest";

import {
    attemptEdit,
    countOccurrences,
    makeUnifiedDiff,
} from "@/utils/edit-note-diff";

describe("attemptEdit", () => {
    it("reports a single replacement and the post-edit content", () => {
        const out = attemptEdit(
            {
                content: "hello world",
                oldText: "world",
                newText: "there",
                replaceAll: false,
            },
            "n.md",
        );
        expect(out).toEqual({
            kind: "ok",
            replacements: 1,
            after: "hello there",
        });
    });

    it("refuses ambiguous matches unless replaceAll is set", () => {
        const out = attemptEdit(
            {
                content: "foo\nfoo",
                oldText: "foo",
                newText: "bar",
                replaceAll: false,
            },
            "n.md",
        );
        expect(out.kind).toBe("error");
        if (out.kind === "error") {
            expect(out.reason).toBe("ambiguous");
            expect(out.replacements).toBe(2);
        }
    });

    it("replaces every occurrence when replaceAll is set", () => {
        const out = attemptEdit(
            {
                content: "foo\nfoo",
                oldText: "foo",
                newText: "bar",
                replaceAll: true,
            },
            "n.md",
        );
        expect(out).toEqual({ kind: "ok", replacements: 2, after: "bar\nbar" });
    });

    it("reports not-found when oldText is absent", () => {
        const out = attemptEdit(
            {
                content: "hello",
                oldText: "missing",
                newText: "x",
                replaceAll: false,
            },
            "n.md",
        );
        expect(out.kind).toBe("error");
        if (out.kind === "error") {
            expect(out.reason).toBe("not-found");
        }
    });
});

describe("countOccurrences", () => {
    it("counts non-overlapping matches", () => {
        expect(countOccurrences("ababab", "ab")).toBe(3);
    });

    it("returns 0 when the needle is not present", () => {
        expect(countOccurrences("abc", "xy")).toBe(0);
    });
});

describe("makeUnifiedDiff", () => {
    it("renders headers and prefixes added / removed / context lines", () => {
        const diff = makeUnifiedDiff("a.md", "hello\nworld", "hello\nthere");
        expect(diff).toBe(
            ["--- a.md", "+++ a.md", " hello", "-world", "+there"].join("\n"),
        );
    });

    it("handles trailing additions and deletions", () => {
        const diff = makeUnifiedDiff("a.md", "x", "x\ny");
        expect(diff).toBe(["--- a.md", "+++ a.md", " x", "+y"].join("\n"));
    });
});
