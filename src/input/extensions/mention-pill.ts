import { Prec, type Extension, RangeSet, RangeSetBuilder } from "@codemirror/state";
import {
    Decoration,
    type DecorationSet,
    EditorView,
    keymap,
    ViewPlugin,
    type ViewUpdate,
    WidgetType,
} from "@codemirror/view";

export type PillKind = "note" | "tag";

interface PillMatch {
    from: number;
    to: number;
    kind: PillKind;
    label: string;
}

export interface MentionPillCallbacks {
    /**
     * Fires after the pill's range has been removed from the doc. UserInput
     * uses this to also drop the matching entry from the chat's linked-notes
     * / linked-tags context, so context state stays in sync with the visible
     * input.
     */
    onRemove?: (kind: PillKind, label: string) => void;
}

const wikilinkPattern = /\[\[([^\]\r\n]+)\]\]/g;
const tagPattern = /(^|\s)(#[A-Za-z][\w/-]*)/g;

/**
 * Pure function: given the full document text, returns all `[[note]]` and
 * `#tag` ranges suitable for decoration. Exported for unit testing — call
 * sites should use {@link mentionPillExtension}.
 */
export function findPillMatches(doc: string): PillMatch[] {
    const out: PillMatch[] = [];

    wikilinkPattern.lastIndex = 0;
    for (let m = wikilinkPattern.exec(doc); m; m = wikilinkPattern.exec(doc)) {
        out.push({
            from: m.index,
            to: m.index + m[0].length,
            kind: "note",
            label: m[1],
        });
    }

    tagPattern.lastIndex = 0;
    for (let m = tagPattern.exec(doc); m; m = tagPattern.exec(doc)) {
        const tagStart = m.index + m[1].length;
        out.push({
            from: tagStart,
            to: tagStart + m[2].length,
            kind: "tag",
            label: m[2],
        });
    }

    out.sort((a, b) => a.from - b.from);
    return out;
}

class PillWidget extends WidgetType {
    constructor(
        private readonly kind: PillKind,
        private readonly label: string,
        private readonly from: number,
        private readonly to: number,
        private readonly callbacks: MentionPillCallbacks,
    ) {
        super();
    }

    eq(other: PillWidget): boolean {
        return (
            other.kind === this.kind &&
            other.label === this.label &&
            other.from === this.from &&
            other.to === this.to
        );
    }

    toDOM(view: EditorView): HTMLElement {
        const el = document.createElement("span");
        el.className = `coi-pill coi-pill-${this.kind}`;

        const labelEl = document.createElement("span");
        labelEl.className = "coi-pill-label";
        labelEl.textContent = this.label;
        el.appendChild(labelEl);

        const removeEl = document.createElement("span");
        removeEl.className = "coi-pill-remove";
        removeEl.setAttribute("role", "button");
        removeEl.setAttribute("aria-label", `Remove ${this.label}`);
        removeEl.textContent = "×";
        removeEl.addEventListener("mousedown", (event) => {
            event.preventDefault();
        });
        removeEl.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            removePillRange(view, this.from, this.to);
            this.callbacks.onRemove?.(this.kind, this.label);
        });
        el.appendChild(removeEl);

        return el;
    }

    ignoreEvent(): boolean {
        return false;
    }
}

function removePillRange(view: EditorView, from: number, to: number): void {
    // Swallow a leading space when the pill sits mid-line so the doc doesn't
    // end up with a double space after removal.
    const before = view.state.doc.sliceString(Math.max(0, from - 1), from);
    const adjustedFrom = before === " " ? from - 1 : from;
    view.dispatch({
        changes: { from: adjustedFrom, to, insert: "" },
        selection: { anchor: adjustedFrom },
    });
    view.focus();
}

function buildDecorations(
    view: EditorView,
    callbacks: MentionPillCallbacks,
): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();
    const doc = view.state.doc.toString();
    const sel = view.state.selection.main;
    for (const match of findPillMatches(doc)) {
        // Don't pill-ify the range the caret is inside — would feel hostile
        // mid-edit. Right boundary is exclusive: a caret resting just after
        // the closing bracket means the user has finished typing the link
        // and the pill should appear immediately.
        if (sel.from >= match.from && sel.from < match.to) continue;
        builder.add(
            match.from,
            match.to,
            Decoration.replace({
                widget: new PillWidget(
                    match.kind,
                    match.label,
                    match.from,
                    match.to,
                    callbacks,
                ),
            }),
        );
    }
    return builder.finish();
}

/**
 * Returns a CodeMirror extension that renders `[[Note]]` and `#tag` ranges
 * as atomic pill widgets with a click-to-remove control. The remove handler
 * dispatches a delete transaction; `callbacks.onRemove` lets callers update
 * any external state (linked-notes context, etc.) when that happens.
 *
 * Decorations rebuild on every doc / selection change so the widgets follow
 * edits. The same ranges are registered as `EditorView.atomicRanges`, so
 * caret navigation skips over the pills and a single Backspace deletes a
 * full pill instead of trying to chip away at one bracket at a time.
 */
export function mentionPillExtension(
    callbacks: MentionPillCallbacks = {},
): Extension {
    const plugin = ViewPlugin.fromClass(
        class {
            decorations: DecorationSet;
            constructor(view: EditorView) {
                this.decorations = buildDecorations(view, callbacks);
            }
            update(update: ViewUpdate): void {
                if (update.docChanged || update.selectionSet) {
                    this.decorations = buildDecorations(update.view, callbacks);
                }
            }
        },
        {
            decorations: (v) => v.decorations,
        },
    );

    const atomicRanges = EditorView.atomicRanges.of((view) => {
        const value = view.plugin(plugin);
        return value?.decorations ?? RangeSet.empty;
    });

    // CM6's default contenteditable delete path doesn't actually honour
    // `atomicRanges` for Backspace — it still chips away one bracket at a
    // time. Catch Backspace / Delete explicitly so a single press wipes the
    // whole pill range and the onRemove hook fires (otherwise pressing × is
    // the only way to drop the context entry, which the user has called out
    // as wrong).
    const deletionKeymap = Prec.high(
        keymap.of([
            {
                key: "Backspace",
                run: (view) =>
                    deletePillAt(view, "before", callbacks),
            },
            {
                key: "Delete",
                run: (view) =>
                    deletePillAt(view, "after", callbacks),
            },
        ]),
    );

    return [plugin, atomicRanges, deletionKeymap];
}

function deletePillAt(
    view: EditorView,
    relativeTo: "before" | "after",
    callbacks: MentionPillCallbacks,
): boolean {
    const sel = view.state.selection.main;
    if (!sel.empty) return false;
    const doc = view.state.doc.toString();
    const matches = findPillMatches(doc);
    for (const match of matches) {
        const matchesCaret =
            relativeTo === "before"
                ? sel.from === match.to
                : sel.from === match.from;
        if (!matchesCaret) continue;
        // Mirror the × button: also swallow a single adjacent space so we
        // don't leave "hi  end" after deleting a mid-line pill.
        let from = match.from;
        let to = match.to;
        if (
            relativeTo === "before" &&
            from > 0 &&
            doc[from - 1] === " "
        ) {
            from -= 1;
        } else if (
            relativeTo === "after" &&
            to < doc.length &&
            doc[to] === " "
        ) {
            to += 1;
        }
        view.dispatch({
            changes: { from, to, insert: "" },
            selection: { anchor: from },
        });
        callbacks.onRemove?.(match.kind, match.label);
        return true;
    }
    return false;
}
