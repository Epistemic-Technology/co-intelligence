import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, keymap, placeholder } from "@codemirror/view";

export interface ComposerCallbacks {
    /**
     * Called when the user presses Enter (without Shift). Receives the current
     * editor contents. If it returns true the editor is cleared; false leaves
     * the text in place (useful for "no model selected" guards).
     */
    onSubmit: (text: string) => boolean;
    /** Optional: Esc handler. Returns true if the press was consumed. */
    onCancel?: () => boolean;
    /**
     * Optional: ArrowUp at the start of the doc recalls the last user message.
     * Returning a string replaces the editor contents; returning null is a
     * no-op (lets the user navigate normally).
     */
    onRecallLast?: () => string | null;
}

export interface ComposerOptions extends ComposerCallbacks {
    parent: HTMLElement;
    initialDoc?: string;
    placeholder?: string;
    /**
     * Extra CM6 extensions appended after the base set. Use this for
     * decorations like the mention-pill or the slash-trigger plugin.
     */
    extensions?: Extension[];
}

export interface ComposerHandle {
    view: EditorView;
    getValue: () => string;
    setValue: (text: string) => void;
    focus: () => void;
    destroy: () => void;
}

/**
 * Mounts a CodeMirror 6 single-line-feel composer into `parent`. The base
 * extension set carries the keymap, paste-as-plaintext rule, line wrapping,
 * and the configured placeholder. Add Phase 4 extensions (mention pills,
 * slash trigger, attachment chips) via `options.extensions`.
 *
 * Keymap:
 *   - Enter:       submit (consumed when onSubmit returns true)
 *   - Shift+Enter: newline
 *   - Esc:         cancel (consumed when onCancel returns true)
 *   - ArrowUp:     at doc start, recall last message via onRecallLast
 */
export function mountComposer(options: ComposerOptions): ComposerHandle {
    const submitKeymap = keymap.of([
        {
            key: "Enter",
            preventDefault: true,
            run(view) {
                const text = view.state.doc.toString();
                const consumed = options.onSubmit(text);
                if (consumed) {
                    view.dispatch({
                        changes: {
                            from: 0,
                            to: view.state.doc.length,
                            insert: "",
                        },
                    });
                }
                return true;
            },
        },
        {
            key: "Shift-Enter",
            run(view) {
                view.dispatch(
                    view.state.replaceSelection("\n"),
                );
                return true;
            },
        },
        {
            key: "Escape",
            run() {
                return options.onCancel?.() ?? false;
            },
        },
        {
            key: "ArrowUp",
            run(view) {
                if (!options.onRecallLast) return false;
                // Only intercept when the caret is at the very top of the doc
                // — otherwise the user is navigating within multi-line input.
                if (view.state.selection.main.head !== 0) return false;
                const recalled = options.onRecallLast();
                if (recalled === null) return false;
                view.dispatch({
                    changes: {
                        from: 0,
                        to: view.state.doc.length,
                        insert: recalled,
                    },
                    selection: { anchor: recalled.length },
                });
                return true;
            },
        },
    ]);

    const pasteAsPlaintext = EditorView.domEventHandlers({
        paste(event, view) {
            const text = event.clipboardData?.getData("text/plain");
            if (text === undefined) return false;
            event.preventDefault();
            view.dispatch(view.state.replaceSelection(text));
            return true;
        },
    });

    const baseExtensions: Extension[] = [
        submitKeymap,
        EditorView.lineWrapping,
        pasteAsPlaintext,
    ];
    if (options.placeholder) {
        baseExtensions.push(placeholder(options.placeholder));
    }

    const view = new EditorView({
        parent: options.parent,
        state: EditorState.create({
            doc: options.initialDoc ?? "",
            extensions: [...baseExtensions, ...(options.extensions ?? [])],
        }),
    });

    return {
        view,
        getValue: () => view.state.doc.toString(),
        setValue(text) {
            view.dispatch({
                changes: {
                    from: 0,
                    to: view.state.doc.length,
                    insert: text,
                },
                selection: { anchor: text.length },
            });
        },
        focus: () => view.focus(),
        destroy: () => view.destroy(),
    };
}
