import {
    Component,
    Accessor,
    createSignal,
    createEffect,
    onCleanup,
    useContext,
    Show,
} from "solid-js";
import { TFile } from "obsidian";

import { ModelSelector } from "@/components/ModelSelector";
import { SystemPromptSelector } from "@/components/SystemPromptSelector";
import { NoteLinkSuggestionModal } from "@/components/NoteLinkSuggestionModal";
import { TagSuggestionModal } from "@/components/TagSuggestionModal";
import { AppContext, PluginContext } from "@/CoiChatApp";
import { ModelRegistry } from "@/services/model-registry";
import { Model, Tag } from "@/types";

import {
    mountComposer,
    type ComposerHandle,
} from "@/input/composer";
import { mentionPillExtension } from "@/input/extensions/mention-pill";

export interface UserInputProps {
    onSubmit: (
        value: string,
        webSearchEnabled: boolean,
        systemPrompt?: string,
    ) => void;
    currentModel: Accessor<Model | null>;
    updateModel: (model: Model | null) => void;
    onLinkNote?: (file: TFile) => void;
    onAddTag?: (tag: Tag) => void;
    initialSystemPrompt?: string;
}

export const UserInput: Component<UserInputProps> = ({
    onSubmit,
    currentModel,
    updateModel,
    onLinkNote,
    onAddTag,
    initialSystemPrompt = "",
}) => {
    const app = useContext(AppContext);
    const plugin = useContext(PluginContext);
    const registry = ModelRegistry.getInstance(plugin);
    const hasModels = () => registry.availableModels.length > 0;

    const [webSearchEnabled, setWebSearchEnabled] = createSignal(false);
    const [selectedSystemPrompt, setSelectedSystemPrompt] =
        createSignal(initialSystemPrompt);
    const [composer, setComposer] = createSignal<ComposerHandle | null>(null);
    const [isModalOpen, setIsModalOpen] = createSignal(false);

    const mountInto = (parent: HTMLDivElement) => {
        const handle = mountComposer({
            parent,
            placeholder: hasModels()
                ? "Type your message..."
                : "No models available",
            extensions: [mentionPillExtension],
            onSubmit(text) {
                const trimmed = text.trim();
                if (!trimmed) return false;
                if (!hasModels()) return false;
                onSubmit(
                    trimmed,
                    webSearchEnabled(),
                    selectedSystemPrompt(),
                );
                return true;
            },
        });
        setComposer(handle);

        const inputListener = () => handleEditorInput(handle);
        handle.view.contentDOM.addEventListener("input", inputListener);

        onCleanup(() => {
            handle.view.contentDOM.removeEventListener(
                "input",
                inputListener,
            );
            handle.destroy();
        });

        // Defer focus until after the mount finishes so CM6's selection is
        // ready to receive it.
        queueMicrotask(() => handle.focus());
    };

    /**
     * Detects `[[` and `#` typing and opens the Obsidian suggestion modal,
     * mirroring the textarea behaviour. Selection from the modal inserts
     * into the composer via dispatch.
     */
    const handleEditorInput = (handle: ComposerHandle) => {
        if (!app || isModalOpen()) return;
        const view = handle.view;
        const head = view.state.selection.main.head;
        const doc = view.state.doc.toString();
        const before = doc.slice(0, head);

        // Just typed `[[`?
        if (before.endsWith("[[")) {
            openWikilinkModal(handle, "");
            return;
        }

        // Caret inside an open `[[...` (no closing `]]` yet on this segment)?
        const openIdx = before.lastIndexOf("[[");
        if (openIdx !== -1) {
            const segment = before.slice(openIdx + 2);
            if (!segment.includes("]") && !segment.includes("\n")) {
                openWikilinkModal(handle, segment);
                return;
            }
        }

        // Just typed `#` (start of doc / line / after whitespace)?
        if (head > 0 && before.endsWith("#")) {
            const prev = head - 2 >= 0 ? doc[head - 2] : "\n";
            if (prev === "" || /\s/.test(prev) || prev === "\n") {
                openTagModal(handle);
                return;
            }
        }
    };

    const openWikilinkModal = (handle: ComposerHandle, query: string) => {
        if (!app) return;
        setIsModalOpen(true);
        const modal = new NoteLinkSuggestionModal(app, query, (file) => {
            insertWikilink(handle, file);
            setIsModalOpen(false);
        });
        modal.onClose = () => setIsModalOpen(false);
        modal.open();
    };

    const openTagModal = (handle: ComposerHandle) => {
        if (!app) return;
        setIsModalOpen(true);
        const modal = new TagSuggestionModal(app, "", (tag) => {
            insertTag(handle, tag);
            setIsModalOpen(false);
        });
        modal.onClose = () => setIsModalOpen(false);
        modal.open();
    };

    /**
     * Replaces the active `[[partial` segment at the caret with a finished
     * `[[Basename]]` wikilink. Idempotent if there's no open bracket.
     */
    const insertWikilink = (handle: ComposerHandle, file: TFile) => {
        const view = handle.view;
        const head = view.state.selection.main.head;
        const doc = view.state.doc.toString();
        const before = doc.slice(0, head);
        const openIdx = before.lastIndexOf("[[");
        const link = `[[${file.basename}]]`;
        if (openIdx === -1) {
            view.dispatch({
                changes: { from: head, insert: link },
                selection: { anchor: head + link.length },
            });
        } else {
            view.dispatch({
                changes: { from: openIdx, to: head, insert: link },
                selection: { anchor: openIdx + link.length },
            });
        }
        view.focus();
        onLinkNote?.(file);
    };

    /**
     * Replaces the trailing `#` (or `#partial`) at the caret with the chosen
     * tag (which itself already includes the leading `#`).
     */
    const insertTag = (handle: ComposerHandle, tag: Tag) => {
        const view = handle.view;
        const head = view.state.selection.main.head;
        const doc = view.state.doc.toString();
        const before = doc.slice(0, head);
        const hashIdx = before.lastIndexOf("#");
        const from = hashIdx === -1 ? head : hashIdx;
        view.dispatch({
            changes: { from, to: head, insert: tag },
            selection: { anchor: from + tag.length },
        });
        view.focus();
        onAddTag?.(tag);
    };

    // Refresh the composer's enabled-feel placeholder if models load later.
    createEffect(() => {
        const handle = composer();
        if (!handle) return;
        handle.view.contentDOM.setAttribute(
            "aria-disabled",
            hasModels() ? "false" : "true",
        );
    });

    const toggleWebSearchEnabled = () => {
        setWebSearchEnabled(!webSearchEnabled());
    };

    return (
        <div class="coi-user-input">
            <div class="coi-composer" ref={mountInto} />
            <div class="coi-user-input-options">
                <ModelSelector
                    selectedModel={currentModel}
                    onModelChange={updateModel}
                />
                <SystemPromptSelector
                    selectedPrompt={selectedSystemPrompt}
                    onPromptChange={setSelectedSystemPrompt}
                />
                <Show when={currentModel()?.toggleWebSearch}>
                    <div>
                        <input
                            type="checkbox"
                            name="webSearchCheckbox"
                            checked={webSearchEnabled()}
                            onChange={toggleWebSearchEnabled}
                        />
                        <label for="webSearchCheckbox">Web search</label>
                    </div>
                </Show>
            </div>
        </div>
    );
};
