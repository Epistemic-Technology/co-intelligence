import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountComposer, type ComposerHandle } from "@/input/composer";

function pressKey(
    handle: ComposerHandle,
    key: string,
    init: KeyboardEventInit = {},
): boolean {
    const event = new KeyboardEvent("keydown", { key, bubbles: true, ...init });
    handle.view.contentDOM.dispatchEvent(event);
    return event.defaultPrevented;
}

describe("mountComposer", () => {
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

    it("renders initialDoc into the editor", () => {
        handle = mountComposer({
            parent,
            initialDoc: "hello",
            onSubmit: () => true,
        });
        expect(handle.getValue()).toBe("hello");
    });

    it("Enter calls onSubmit and clears the editor when handler returns true", () => {
        const onSubmit = vi.fn().mockReturnValue(true);
        handle = mountComposer({
            parent,
            initialDoc: "hello",
            onSubmit,
        });
        pressKey(handle, "Enter");
        expect(onSubmit).toHaveBeenCalledWith("hello");
        expect(handle.getValue()).toBe("");
    });

    it("Enter leaves the doc intact when onSubmit returns false", () => {
        handle = mountComposer({
            parent,
            initialDoc: "hello",
            onSubmit: () => false,
        });
        pressKey(handle, "Enter");
        expect(handle.getValue()).toBe("hello");
    });

    it("Shift+Enter inserts a newline at the caret instead of submitting", () => {
        const onSubmit = vi.fn().mockReturnValue(true);
        handle = mountComposer({
            parent,
            initialDoc: "ab",
            onSubmit,
        });
        handle.view.dispatch({ selection: { anchor: 1 } });
        pressKey(handle, "Enter", { shiftKey: true });
        expect(onSubmit).not.toHaveBeenCalled();
        expect(handle.getValue()).toBe("a\nb");
    });

    it("Esc invokes onCancel", () => {
        const onCancel = vi.fn().mockReturnValue(true);
        handle = mountComposer({
            parent,
            onSubmit: () => true,
            onCancel,
        });
        pressKey(handle, "Escape");
        expect(onCancel).toHaveBeenCalled();
    });

    it("ArrowUp at doc start recalls the last message", () => {
        const onRecallLast = vi.fn().mockReturnValue("recalled");
        handle = mountComposer({
            parent,
            onSubmit: () => true,
            onRecallLast,
        });
        handle.view.dispatch({ selection: { anchor: 0 } });
        pressKey(handle, "ArrowUp");
        expect(onRecallLast).toHaveBeenCalled();
        expect(handle.getValue()).toBe("recalled");
    });

    it("ArrowUp is a no-op away from doc start", () => {
        const onRecallLast = vi.fn().mockReturnValue("recalled");
        handle = mountComposer({
            parent,
            initialDoc: "hello",
            onSubmit: () => true,
            onRecallLast,
        });
        handle.view.dispatch({ selection: { anchor: 3 } });
        pressKey(handle, "ArrowUp");
        expect(onRecallLast).not.toHaveBeenCalled();
    });

    it("setValue replaces the document and moves the caret to the end", () => {
        handle = mountComposer({
            parent,
            initialDoc: "old",
            onSubmit: () => true,
        });
        handle.setValue("new value");
        expect(handle.getValue()).toBe("new value");
        expect(handle.view.state.selection.main.head).toBe("new value".length);
    });

    it("paste replaces selection with plain text", () => {
        handle = mountComposer({
            parent,
            onSubmit: () => true,
        });
        // jsdom doesn't ship DataTransfer, so build a minimal stub the
        // composer's paste handler will accept.
        const event = new Event("paste", {
            bubbles: true,
            cancelable: true,
        });
        Object.defineProperty(event, "clipboardData", {
            value: { getData: (t: string) => (t === "text/plain" ? "hi" : "") },
        });
        handle.view.contentDOM.dispatchEvent(event);
        expect(handle.getValue()).toBe("hi");
    });
});
