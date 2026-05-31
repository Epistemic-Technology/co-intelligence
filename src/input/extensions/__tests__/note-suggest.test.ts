import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mountComposer, type ComposerHandle } from "@/input/composer";
import {
    noteSuggestExtension,
    type NoteSuggestItem,
} from "@/input/extensions/note-suggest";

function makeProviders(notes: NoteSuggestItem[] = []) {
    const onInsertNote = vi.fn();
    const onInsertTag = vi.fn();
    return {
        providers: {
            notes: vi.fn().mockReturnValue(notes),
            tags: vi.fn().mockReturnValue([] as NoteSuggestItem[]),
            onInsertNote,
            onInsertTag,
        },
        onInsertNote,
        onInsertTag,
    };
}

function typeAt(handle: ComposerHandle, pos: number, text: string) {
    handle.view.dispatch({
        changes: { from: pos, insert: text },
        selection: { anchor: pos + text.length },
    });
}

function tooltipEl(): HTMLDivElement | null {
    return document.querySelector(".coi-suggest");
}

describe("noteSuggestExtension", () => {
    let parent: HTMLDivElement;
    let handle: ComposerHandle;

    beforeEach(() => {
        parent = document.createElement("div");
        document.body.appendChild(parent);
    });

    afterEach(() => {
        handle?.destroy();
        document.querySelectorAll(".coi-suggest").forEach((n) => n.remove());
        parent.remove();
    });

    it("opens after typing [[", () => {
        const { providers } = makeProviders([
            { label: "Foo", insertText: "Foo" },
        ]);
        handle = mountComposer({
            parent,
            onSubmit: () => true,
            extensions: [noteSuggestExtension(providers)],
        });
        typeAt(handle, 0, "[[");
        expect(providers.notes).toHaveBeenCalledWith("");
        expect(tooltipEl()).not.toBeNull();
    });

    it("filters by the trailing query and re-renders", () => {
        const { providers } = makeProviders([
            { label: "Foo", insertText: "Foo" },
        ]);
        handle = mountComposer({
            parent,
            onSubmit: () => true,
            extensions: [noteSuggestExtension(providers)],
        });
        typeAt(handle, 0, "[[Fo");
        const last = providers.notes.mock.calls.at(-1);
        expect(last?.[0]).toBe("fo");
        expect(tooltipEl()?.querySelector(".coi-suggest-label")?.textContent).toBe(
            "Foo",
        );
    });

    it("closes when the doc no longer matches a wikilink prefix", () => {
        const { providers } = makeProviders([
            { label: "Foo", insertText: "Foo" },
        ]);
        handle = mountComposer({
            parent,
            onSubmit: () => true,
            initialDoc: "[[Fo",
            extensions: [noteSuggestExtension(providers)],
        });
        // Caret at end after initial doc render
        handle.view.dispatch({ selection: { anchor: 4 } });
        expect(tooltipEl()).not.toBeNull();
        // Now delete the [[ to drop the trigger
        handle.view.dispatch({
            changes: { from: 0, to: 4, insert: "" },
            selection: { anchor: 0 },
        });
        expect(tooltipEl()).toBeNull();
    });

    it("inserts [[Label]] and fires onInsertNote on accept", () => {
        const { providers, onInsertNote } = makeProviders([
            { label: "Foo Bar", insertText: "Foo Bar" },
        ]);
        handle = mountComposer({
            parent,
            onSubmit: () => true,
            extensions: [noteSuggestExtension(providers)],
        });
        typeAt(handle, 0, "[[Fo");
        // Simulate Enter
        const event = new KeyboardEvent("keydown", {
            key: "Enter",
            bubbles: true,
        });
        handle.view.contentDOM.dispatchEvent(event);
        expect(handle.getValue()).toBe("[[Foo Bar]]");
        expect(onInsertNote).toHaveBeenCalledWith("Foo Bar");
    });

    it("detects #tag triggers", () => {
        const { providers } = makeProviders();
        providers.tags.mockReturnValue([
            { label: "#topic", insertText: "#topic" },
        ]);
        handle = mountComposer({
            parent,
            onSubmit: () => true,
            extensions: [noteSuggestExtension(providers)],
        });
        typeAt(handle, 0, "#to");
        expect(providers.tags).toHaveBeenCalledWith("to");
        expect(tooltipEl()).not.toBeNull();
    });

    it("Escape closes without inserting", () => {
        const { providers, onInsertNote } = makeProviders([
            { label: "Foo", insertText: "Foo" },
        ]);
        handle = mountComposer({
            parent,
            onSubmit: () => true,
            extensions: [noteSuggestExtension(providers)],
        });
        typeAt(handle, 0, "[[Fo");
        const event = new KeyboardEvent("keydown", {
            key: "Escape",
            bubbles: true,
        });
        handle.view.contentDOM.dispatchEvent(event);
        expect(tooltipEl()).toBeNull();
        expect(onInsertNote).not.toHaveBeenCalled();
        // Doc unchanged
        expect(handle.getValue()).toBe("[[Fo");
    });
});
