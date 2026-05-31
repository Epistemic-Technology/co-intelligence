import { Prec, type Extension } from "@codemirror/state";
import {
    EditorView,
    keymap,
    ViewPlugin,
    type ViewUpdate,
} from "@codemirror/view";

export type SuggestKind = "note" | "tag";

export interface NoteSuggestItem {
    /** Display label (note basename or full `#tag`). */
    label: string;
    /** Optional second line (folder path for notes). */
    sublabel?: string;
    /**
     * Text inserted between the trigger characters. For wikilinks this is
     * the basename (we wrap with `[[ ]]`); for tags it's the full `#tag`
     * (we replace the trigger range entirely).
     */
    insertText: string;
}

export interface NoteSuggestProviders {
    notes: (query: string) => NoteSuggestItem[];
    tags: (query: string) => NoteSuggestItem[];
    /** Fires after a note has been inserted via the suggester. */
    onInsertNote?: (label: string) => void;
    /** Fires after a tag has been inserted via the suggester. */
    onInsertTag?: (label: string) => void;
}

interface DetectResult {
    kind: SuggestKind;
    from: number;
    to: number;
    query: string;
}

interface SuggestState extends DetectResult {
    items: NoteSuggestItem[];
    selectedIdx: number;
}

class SuggestController {
    state: SuggestState | null = null;
    private tooltipEl: HTMLDivElement | null = null;

    constructor(
        private readonly view: EditorView,
        private readonly providers: NoteSuggestProviders,
    ) {
        this.refresh();
    }

    update(update: ViewUpdate): void {
        if (update.docChanged || update.selectionSet) {
            this.refresh();
        }
    }

    destroy(): void {
        this.removeTooltip();
    }

    isActive(): boolean {
        return this.state !== null;
    }

    move(delta: number): void {
        if (!this.state || this.state.items.length === 0) return;
        const len = this.state.items.length;
        this.state.selectedIdx = (this.state.selectedIdx + delta + len) % len;
        this.renderTooltip();
    }

    accept(): boolean {
        const state = this.state;
        if (!state || state.items.length === 0) return false;
        const item = state.items[state.selectedIdx];
        const insert =
            state.kind === "note"
                ? `[[${item.insertText}]]`
                : item.insertText;
        this.view.dispatch({
            changes: { from: state.from, to: state.to, insert },
            selection: { anchor: state.from + insert.length },
        });
        if (state.kind === "note") {
            this.providers.onInsertNote?.(item.label);
        } else {
            this.providers.onInsertTag?.(item.label);
        }
        this.close();
        return true;
    }

    close(): void {
        this.state = null;
        this.removeTooltip();
    }

    private refresh(): void {
        const detected = detectActive(this.view);
        if (!detected) {
            this.close();
            return;
        }
        const items =
            detected.kind === "note"
                ? this.providers.notes(detected.query.toLowerCase())
                : this.providers.tags(detected.query.toLowerCase());
        if (items.length === 0) {
            this.close();
            return;
        }
        const prevIdx = this.state?.selectedIdx ?? 0;
        this.state = {
            ...detected,
            items,
            selectedIdx: Math.min(prevIdx, items.length - 1),
        };
        this.renderTooltip();
    }

    private renderTooltip(): void {
        if (!this.state) return;
        if (!this.tooltipEl) {
            this.tooltipEl = document.createElement("div");
            this.tooltipEl.className = "coi-suggest";
            document.body.appendChild(this.tooltipEl);
        }
        const el = this.tooltipEl;
        el.empty();
        const state = this.state;
        state.items.forEach((item, idx) => {
            const row = el.createDiv({
                cls:
                    "coi-suggest-item" +
                    (idx === state.selectedIdx ? " is-selected" : ""),
            });
            row.createDiv({
                cls: "coi-suggest-label",
                text: item.label,
            });
            if (item.sublabel) {
                row.createDiv({
                    cls: "coi-suggest-sublabel",
                    text: item.sublabel,
                });
            }
            row.addEventListener("mousedown", (event) => {
                event.preventDefault();
                state.selectedIdx = idx;
                this.accept();
            });
        });
        this.positionTooltip();
    }

    private positionTooltip(): void {
        if (!this.tooltipEl || !this.state) return;
        const coords = this.view.coordsAtPos(this.state.from);
        if (!coords) return;
        this.tooltipEl.style.position = "fixed";
        this.tooltipEl.style.left = `${coords.left}px`;
        this.tooltipEl.style.top = `${coords.bottom + 4}px`;
    }

    private removeTooltip(): void {
        this.tooltipEl?.remove();
        this.tooltipEl = null;
    }
}

function detectActive(view: EditorView): DetectResult | null {
    const head = view.state.selection.main.head;
    const doc = view.state.doc.toString();
    const before = doc.slice(0, head);

    const openIdx = before.lastIndexOf("[[");
    if (openIdx !== -1) {
        const segment = before.slice(openIdx + 2);
        if (!segment.includes("]") && !segment.includes("\n")) {
            return {
                kind: "note",
                from: openIdx,
                to: head,
                query: segment,
            };
        }
    }

    const tagMatch = /(^|\s)(#[A-Za-z][\w/-]*)$/.exec(before);
    if (tagMatch) {
        const tagStart = head - tagMatch[2].length;
        return {
            kind: "tag",
            from: tagStart,
            to: head,
            query: tagMatch[2].slice(1),
        };
    }

    return null;
}

/**
 * Inline `[[wikilink]]` / `#tag` suggester. Activates whenever the caret
 * sits inside an unclosed `[[…` or just after a `#tag` prefix; a small
 * tooltip appears under the caret with up to 10 ranked matches. Arrow keys
 * navigate, Enter / Tab inserts, Esc dismisses without inserting. Matches
 * the feel of Obsidian's built-in note autocomplete instead of popping a
 * full-screen modal.
 */
export function noteSuggestExtension(
    providers: NoteSuggestProviders,
): Extension {
    const plugin = ViewPlugin.define((view) => new SuggestController(view, providers));

    const handle = (
        view: EditorView,
        fn: (c: SuggestController) => boolean | void,
    ): boolean => {
        const controller = view.plugin(plugin);
        if (!controller || !controller.isActive()) return false;
        const result = fn(controller);
        return result !== false;
    };

    const suggestKeymap = Prec.high(
        keymap.of([
            {
                key: "ArrowDown",
                run: (view) =>
                    handle(view, (c) => {
                        c.move(1);
                    }),
            },
            {
                key: "ArrowUp",
                run: (view) =>
                    handle(view, (c) => {
                        c.move(-1);
                    }),
            },
            {
                key: "Enter",
                run: (view) => handle(view, (c) => c.accept()),
            },
            {
                key: "Tab",
                run: (view) => handle(view, (c) => c.accept()),
            },
            {
                key: "Escape",
                run: (view) =>
                    handle(view, (c) => {
                        c.close();
                    }),
            },
        ]),
    );

    return [plugin, suggestKeymap];
}
