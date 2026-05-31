import { type Extension, RangeSetBuilder } from "@codemirror/state";
import {
    Decoration,
    type DecorationSet,
    EditorView,
    ViewPlugin,
    type ViewUpdate,
    WidgetType,
} from "@codemirror/view";

type PillKind = "note" | "tag";

interface PillMatch {
    from: number;
    to: number;
    kind: PillKind;
    label: string;
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
        el.dataset.from = String(this.from);
        el.dataset.to = String(this.to);

        const labelEl = document.createElement("span");
        labelEl.className = "coi-pill-label";
        labelEl.textContent = this.label;
        el.appendChild(labelEl);

        const removeEl = document.createElement("button");
        removeEl.className = "coi-pill-remove";
        removeEl.type = "button";
        removeEl.setAttribute("aria-label", `Remove ${this.label}`);
        removeEl.textContent = "×";
        removeEl.addEventListener("mousedown", (event) => {
            event.preventDefault();
        });
        removeEl.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            removePillRange(view, this.from, this.to);
        });
        el.appendChild(removeEl);

        return el;
    }

    ignoreEvent(): boolean {
        // Let our own click handlers fire, but tell CM6 to ignore everything
        // else (so the widget really is atomic).
        return false;
    }
}

function removePillRange(view: EditorView, from: number, to: number): void {
    // Also swallow a leading space when the pill sits mid-line, so the doc
    // doesn't end up with a double space after removal.
    const before = view.state.doc.sliceString(Math.max(0, from - 1), from);
    const adjustedFrom = before === " " ? from - 1 : from;
    view.dispatch({
        changes: { from: adjustedFrom, to, insert: "" },
        selection: { anchor: adjustedFrom },
    });
    view.focus();
}

function buildDecorations(view: EditorView): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();
    const doc = view.state.doc.toString();
    const sel = view.state.selection.main;
    for (const match of findPillMatches(doc)) {
        // Don't pill-ify the range the caret is inside — would feel hostile
        // mid-edit. The user finishes the bracket / tag and then it becomes
        // a pill.
        if (sel.from >= match.from && sel.from <= match.to) continue;
        builder.add(
            match.from,
            match.to,
            Decoration.replace({
                widget: new PillWidget(
                    match.kind,
                    match.label,
                    match.from,
                    match.to,
                ),
            }),
        );
    }
    return builder.finish();
}

/**
 * CodeMirror extension that renders `[[Note]]` and `#tag` ranges as atomic
 * pill widgets with a click-to-remove button. Lives in {@link buildDecorations}
 * — rebuilt on every doc / selection change so the widgets follow edits.
 */
export const mentionPillExtension: Extension = ViewPlugin.fromClass(
    class {
        decorations: DecorationSet;
        constructor(view: EditorView) {
            this.decorations = buildDecorations(view);
        }
        update(update: ViewUpdate): void {
            if (update.docChanged || update.selectionSet) {
                this.decorations = buildDecorations(update.view);
            }
        }
    },
    {
        decorations: (v) => v.decorations,
    },
);
