import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { mountComposer, type ComposerHandle } from "@/input/composer";
import {
    findPillMatches,
    mentionPillExtension,
} from "@/input/extensions/mention-pill";

describe("findPillMatches", () => {
    it("finds wikilinks", () => {
        const m = findPillMatches("hello [[Foo]] world");
        expect(m).toEqual([
            { from: 6, to: 13, kind: "note", label: "Foo" },
        ]);
    });

    it("finds tags after spaces and at line start", () => {
        const m = findPillMatches("#one and #two-tag");
        expect(m.map((p) => p.label)).toEqual(["#one", "#two-tag"]);
    });

    it("doesn't match # mid-word (e.g. a URL fragment)", () => {
        const m = findPillMatches("foo#bar");
        expect(m).toEqual([]);
    });

    it("sorts results by position", () => {
        const m = findPillMatches("#a [[Foo]] #b");
        expect(m.map((p) => [p.from, p.label])).toEqual([
            [0, "#a"],
            [3, "Foo"],
            [11, "#b"],
        ]);
    });

    it("returns an empty set for plain text", () => {
        expect(findPillMatches("nothing here")).toEqual([]);
    });
});

describe("mentionPillExtension", () => {
    let parent: HTMLDivElement;
    let handle: ComposerHandle;

    beforeEach(() => {
        parent = document.createElement("div");
        document.body.appendChild(parent);
    });

    afterEach(() => {
        handle?.destroy();
        parent.remove();
    });

    it("renders a pill widget for [[Foo]] when caret is elsewhere", () => {
        handle = mountComposer({
            parent,
            initialDoc: "hi [[Foo]]",
            onSubmit: () => true,
            extensions: [mentionPillExtension()],
        });
        // Move caret away from the wikilink range.
        handle.view.dispatch({ selection: { anchor: 0 } });
        const pill = parent.querySelector(".coi-pill-note");
        expect(pill).not.toBeNull();
        expect(pill?.querySelector(".coi-pill-label")?.textContent).toBe(
            "Foo",
        );
    });

    it("doesn't pillify the range the caret is inside", () => {
        handle = mountComposer({
            parent,
            initialDoc: "[[Foo]]",
            onSubmit: () => true,
            extensions: [mentionPillExtension()],
        });
        handle.view.dispatch({ selection: { anchor: 3 } });
        expect(parent.querySelector(".coi-pill-note")).toBeNull();
    });

    it("Backspace from just after a pill deletes the whole range and fires onRemove", () => {
        const onRemove = vi.fn();
        handle = mountComposer({
            parent,
            initialDoc: "hi [[Foo]] end",
            onSubmit: () => true,
            extensions: [mentionPillExtension({ onRemove })],
        });
        // Caret immediately after `]]`
        handle.view.dispatch({ selection: { anchor: 10 } });
        const event = new KeyboardEvent("keydown", {
            key: "Backspace",
            bubbles: true,
        });
        handle.view.contentDOM.dispatchEvent(event);
        expect(handle.getValue()).toBe("hi end");
        expect(onRemove).toHaveBeenCalledWith("note", "Foo");
    });

    it("Delete from just before a pill deletes the whole range", () => {
        handle = mountComposer({
            parent,
            initialDoc: "hi [[Foo]] end",
            onSubmit: () => true,
            extensions: [mentionPillExtension()],
        });
        // Caret immediately before `[[`
        handle.view.dispatch({ selection: { anchor: 3 } });
        const event = new KeyboardEvent("keydown", {
            key: "Delete",
            bubbles: true,
        });
        handle.view.contentDOM.dispatchEvent(event);
        expect(handle.getValue()).toBe("hi end");
    });

    it("clicking the remove button strips the pill range", () => {
        handle = mountComposer({
            parent,
            initialDoc: "hi [[Foo]] end",
            onSubmit: () => true,
            extensions: [mentionPillExtension()],
        });
        handle.view.dispatch({ selection: { anchor: 0 } });
        const remove = parent.querySelector<HTMLButtonElement>(
            ".coi-pill-remove",
        );
        expect(remove).not.toBeNull();
        remove!.click();
        expect(handle.getValue()).toBe("hi end");
    });
});
