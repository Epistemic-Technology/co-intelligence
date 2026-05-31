import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mountComposer, type ComposerHandle } from "@/input/composer";
import {
    slashTriggerExtension,
    type SlashSuggestItem,
} from "@/input/extensions/slash-trigger";

function typeAt(handle: ComposerHandle, pos: number, text: string) {
    handle.view.dispatch({
        changes: { from: pos, insert: text },
        selection: { anchor: pos + text.length },
    });
}

function paletteEl(): HTMLDivElement | null {
    return document.querySelector(".coi-slash-palette");
}

function makeProviders(items: SlashSuggestItem[]) {
    const list = vi.fn().mockReturnValue(items);
    const onAccept = vi.fn();
    return { list, onAccept, callbacks: { list, onAccept } };
}

describe("slashTriggerExtension", () => {
    let parent: HTMLDivElement;
    let handle: ComposerHandle;

    beforeEach(() => {
        parent = document.createElement("div");
        document.body.appendChild(parent);
    });

    afterEach(() => {
        handle?.destroy();
        document.querySelectorAll(".coi-slash-palette").forEach((n) => n.remove());
        parent.remove();
    });

    it("opens when the doc starts with /", () => {
        const { callbacks } = makeProviders([
            { name: "clear", description: "Clear chat" },
        ]);
        handle = mountComposer({
            parent,
            onSubmit: () => true,
            extensions: [slashTriggerExtension(callbacks)],
        });
        typeAt(handle, 0, "/");
        expect(callbacks.list).toHaveBeenCalledWith("");
        expect(paletteEl()).not.toBeNull();
    });

    it("does not open for slashes in the middle of the doc", () => {
        const { callbacks } = makeProviders([
            { name: "clear", description: "Clear chat" },
        ]);
        handle = mountComposer({
            parent,
            onSubmit: () => true,
            initialDoc: "hello",
            extensions: [slashTriggerExtension(callbacks)],
        });
        handle.view.dispatch({ selection: { anchor: 5 } });
        typeAt(handle, 5, "/");
        expect(paletteEl()).toBeNull();
    });

    it("filters by the typed command name", () => {
        const items: SlashSuggestItem[] = [
            { name: "clear", description: "Clear chat" },
            { name: "model", description: "Switch model" },
        ];
        const { callbacks } = makeProviders(items);
        handle = mountComposer({
            parent,
            onSubmit: () => true,
            extensions: [slashTriggerExtension(callbacks)],
        });
        typeAt(handle, 0, "/cle");
        const last = callbacks.list.mock.calls.at(-1);
        expect(last?.[0]).toBe("cle");
    });

    it("Enter fires onAccept with the chosen name + raw args", () => {
        const { callbacks, onAccept } = makeProviders([
            { name: "model", description: "Switch model" },
        ]);
        handle = mountComposer({
            parent,
            onSubmit: () => true,
            extensions: [slashTriggerExtension(callbacks)],
        });
        typeAt(handle, 0, "/model gpt-4");
        const event = new KeyboardEvent("keydown", {
            key: "Enter",
            bubbles: true,
        });
        handle.view.contentDOM.dispatchEvent(event);
        expect(onAccept).toHaveBeenCalledWith("model", "gpt-4");
    });

    it("Escape closes the palette without inserting", () => {
        const { callbacks, onAccept } = makeProviders([
            { name: "clear", description: "Clear chat" },
        ]);
        handle = mountComposer({
            parent,
            onSubmit: () => true,
            extensions: [slashTriggerExtension(callbacks)],
        });
        typeAt(handle, 0, "/cle");
        const event = new KeyboardEvent("keydown", {
            key: "Escape",
            bubbles: true,
        });
        handle.view.contentDOM.dispatchEvent(event);
        expect(paletteEl()).toBeNull();
        expect(onAccept).not.toHaveBeenCalled();
        expect(handle.getValue()).toBe("/cle");
    });

    it("closes when the leading / is deleted", () => {
        const { callbacks } = makeProviders([
            { name: "clear", description: "Clear chat" },
        ]);
        handle = mountComposer({
            parent,
            onSubmit: () => true,
            initialDoc: "/cle",
            extensions: [slashTriggerExtension(callbacks)],
        });
        handle.view.dispatch({ selection: { anchor: 4 } });
        expect(paletteEl()).not.toBeNull();
        handle.view.dispatch({
            changes: { from: 0, to: 4, insert: "" },
            selection: { anchor: 0 },
        });
        expect(paletteEl()).toBeNull();
    });
});
