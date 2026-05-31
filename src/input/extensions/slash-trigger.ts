import { Prec, type Extension } from "@codemirror/state";
import {
    EditorView,
    keymap,
    ViewPlugin,
    type ViewUpdate,
} from "@codemirror/view";

export interface SlashSuggestItem {
    /** Command name without the leading `/`. */
    name: string;
    description: string;
    /** Hint shown next to the name, e.g. `<id>` or `on|off`. */
    parameterHint?: string;
}

export interface SlashTriggerCallbacks {
    /** Filters and ranks the items for a given query (text after the `/`). */
    list: (query: string) => SlashSuggestItem[];
    /**
     * Called when the user accepts an item (Enter / Tab / click). Receives
     * the selected command name and the rest of the line as raw args. The
     * composer text is left in place; the caller decides whether to clear
     * the editor or run the command directly.
     */
    onAccept: (name: string, args: string) => void;
}

interface SlashState {
    /** Caret position after the trailing typed character. */
    from: number;
    to: number;
    /** The text the user typed after `/`. May contain spaces (`/model gpt-4`). */
    line: string;
    items: SlashSuggestItem[];
    selectedIdx: number;
}

class SlashController {
    state: SlashState | null = null;
    private tooltipEl: HTMLDivElement | null = null;

    constructor(
        private readonly view: EditorView,
        private readonly callbacks: SlashTriggerCallbacks,
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

    /**
     * Runs the user's chosen item. The caller's onAccept handler decides
     * what to do with the editor contents — typically clear it and execute
     * the command immediately.
     */
    accept(): boolean {
        const state = this.state;
        if (!state || state.items.length === 0) return false;
        const item = state.items[state.selectedIdx];
        const { args } = splitNameArgs(state.line);
        this.close();
        this.callbacks.onAccept(item.name, args);
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
        const { name } = splitNameArgs(detected.line);
        const items = this.callbacks.list(name.toLowerCase());
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
            this.tooltipEl.className = "coi-suggest coi-slash-palette";
            this.tooltipEl.style.position = "fixed";
            this.tooltipEl.style.left = "-9999px";
            document.body.appendChild(this.tooltipEl);
        }
        const el = this.tooltipEl;
        el.textContent = "";
        const state = this.state;
        state.items.forEach((item, idx) => {
            const row = document.createElement("div");
            row.className =
                "coi-suggest-item" +
                (idx === state.selectedIdx ? " is-selected" : "");
            const labelLine = document.createElement("div");
            labelLine.className = "coi-suggest-label";
            labelLine.textContent = item.parameterHint
                ? `/${item.name} ${item.parameterHint}`
                : `/${item.name}`;
            row.appendChild(labelLine);
            if (item.description) {
                const desc = document.createElement("div");
                desc.className = "coi-suggest-sublabel";
                desc.textContent = item.description;
                row.appendChild(desc);
            }
            row.addEventListener("mousedown", (event) => {
                event.preventDefault();
                state.selectedIdx = idx;
                this.accept();
            });
            el.appendChild(row);
        });
        this.positionTooltip();
    }

    private positionTooltip(): void {
        this.view.requestMeasure({
            read: () => {
                if (!this.state) return null;
                const caret = this.view.coordsAtPos(this.state.to);
                if (caret) return caret;
                return this.view.contentDOM.getBoundingClientRect();
            },
            write: (rect) => {
                if (!rect || !this.tooltipEl) return;
                this.tooltipEl.style.left = `${rect.left}px`;
                this.tooltipEl.style.top = `${rect.bottom + 4}px`;
            },
        });
    }

    private removeTooltip(): void {
        this.tooltipEl?.remove();
        this.tooltipEl = null;
    }
}

function detectActive(
    view: EditorView,
): { from: number; to: number; line: string } | null {
    const doc = view.state.doc.toString();
    const head = view.state.selection.main.head;
    // Slash palette is only active when the whole doc starts with `/`. That
    // keeps "10/20" or mid-message slashes from triggering the palette.
    if (doc.length === 0 || doc[0] !== "/") return null;
    // The user might be typing args after the command name — keep the
    // palette open until they break onto a new line (which a single-line
    // chat composer never does, but guard anyway).
    if (doc.includes("\n")) return null;
    return {
        from: 0,
        to: head,
        line: doc.slice(1),
    };
}

function splitNameArgs(line: string): { name: string; args: string } {
    const space = line.indexOf(" ");
    if (space === -1) return { name: line, args: "" };
    return {
        name: line.slice(0, space),
        args: line.slice(space + 1).trim(),
    };
}

/**
 * Inline slash-command palette. Activates whenever the composer's doc starts
 * with `/`. Lists ranked matches under the caret with a tooltip; arrow keys
 * navigate, Enter / Tab commits via `onAccept`, Esc dismisses (leaving the
 * `/` text intact so the user can keep editing or backspace it away).
 */
export function slashTriggerExtension(
    callbacks: SlashTriggerCallbacks,
): Extension {
    const plugin = ViewPlugin.define(
        (view) => new SlashController(view, callbacks),
    );

    const handle = (
        view: EditorView,
        fn: (c: SlashController) => boolean | void,
    ): boolean => {
        const controller = view.plugin(plugin);
        if (!controller || !controller.isActive()) return false;
        const result = fn(controller);
        return result !== false;
    };

    const slashKeymap = Prec.high(
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

    return [plugin, slashKeymap];
}
