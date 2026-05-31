import {
    Component,
    Accessor,
    createSignal,
    createEffect,
    onCleanup,
    onMount,
    useContext,
    Show,
} from "solid-js";
import { TFile } from "obsidian";

import { ModelSelector } from "@/components/ModelSelector";
import { SystemPromptSelector } from "@/components/SystemPromptSelector";
import { AppContext, PluginContext } from "@/CoiChatApp";
import { ModelRegistry } from "@/services/model-registry";
import { Model, Tag } from "@/types";

import { mountComposer, type ComposerHandle } from "@/input/composer";
import { mentionPillExtension } from "@/input/extensions/mention-pill";
import {
    noteSuggestExtension,
    type NoteSuggestItem,
    type NoteSuggestProviders,
} from "@/input/extensions/note-suggest";

export interface UserInputProps {
    onSubmit: (
        value: string,
        webSearchEnabled: boolean,
        systemPrompt?: string,
    ) => void;
    currentModel: Accessor<Model | null>;
    updateModel: (model: Model | null) => void;
    onLinkNote?: (file: TFile) => void;
    onRemoveNote?: (file: TFile) => void;
    onAddTag?: (tag: Tag) => void;
    onRemoveTag?: (tag: Tag) => void;
    initialSystemPrompt?: string;
}

export const UserInput: Component<UserInputProps> = ({
    onSubmit,
    currentModel,
    updateModel,
    onLinkNote,
    onRemoveNote,
    onAddTag,
    onRemoveTag,
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

    let composerHost: HTMLDivElement | undefined;

    const findFileByBasename = (basename: string): TFile | null => {
        if (!app) return null;
        const matches = app.vault
            .getMarkdownFiles()
            .filter((f) => f.basename === basename);
        return matches[0] ?? null;
    };

    const suggestProviders: NoteSuggestProviders = {
        notes(query) {
            if (!app) return [];
            const files = app.vault.getMarkdownFiles();
            const rank = (f: TFile): number => {
                const name = f.basename.toLowerCase();
                if (name.startsWith(query)) return 0;
                if (name.includes(query)) return 1;
                return 2;
            };
            return files
                .map((f) => [f, rank(f)] as const)
                .filter(([, r]) => r < 2 || query === "")
                .sort((a, b) => a[1] - b[1])
                .slice(0, 10)
                .map<NoteSuggestItem>(([f]) => ({
                    label: f.basename,
                    sublabel: f.parent?.path ? `${f.parent.path}/` : "",
                    insertText: f.basename,
                }));
        },
        tags(query) {
            if (!app) return [];
            // metadataCache.getTags returns { '#foo': count } when available.
            const map =
                (
                    app.metadataCache as unknown as {
                        getTags?: () => Record<string, number>;
                    }
                ).getTags?.() ?? {};
            const all = Object.keys(map);
            return all
                .filter((t) => t.toLowerCase().includes(query))
                .sort((a, b) => a.localeCompare(b))
                .slice(0, 10)
                .map<NoteSuggestItem>((t) => ({
                    label: t,
                    insertText: t,
                }));
        },
        onInsertNote(label) {
            const file = findFileByBasename(label);
            if (file) onLinkNote?.(file);
        },
        onInsertTag(label) {
            onAddTag?.(label);
        },
    };

    const handlePillRemove = (kind: "note" | "tag", label: string) => {
        if (kind === "note") {
            const file = findFileByBasename(label);
            if (file) onRemoveNote?.(file);
        } else {
            onRemoveTag?.(label);
        }
    };

    // The mount runs in onMount (not in ref={...}) so the host element is
    // attached to the document by the time CM6 reads
    // `parent.ownerDocument.defaultView`.
    onMount(() => {
        if (!composerHost) return;
        const handle = mountComposer({
            parent: composerHost,
            placeholder: hasModels()
                ? "Type your message..."
                : "No models available",
            extensions: [
                noteSuggestExtension(suggestProviders),
                mentionPillExtension({ onRemove: handlePillRemove }),
            ],
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
        onCleanup(() => handle.destroy());
        handle.focus();
    });

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
            <div
                class="coi-composer"
                ref={(el) => {
                    composerHost = el;
                }}
            />
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
