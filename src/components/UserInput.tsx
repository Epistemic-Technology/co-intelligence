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
import type { SessionStore } from "@/session/session-store";

import { mountComposer, type ComposerHandle } from "@/input/composer";
import { mentionPillExtension } from "@/input/extensions/mention-pill";
import {
    noteSuggestExtension,
    type NoteSuggestItem,
    type NoteSuggestProviders,
} from "@/input/extensions/note-suggest";
import {
    slashTriggerExtension,
    type SlashSuggestItem,
} from "@/input/extensions/slash-trigger";
import { parseCommandLine } from "@/input/command-registry";
import type { ChatCommandHost } from "@/input/commands";

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
    /** Required so slash commands like `/clear` can act on the session. */
    store: SessionStore;
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
    store,
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

    /**
     * Builds the per-invocation host commands run against. We rebuild on
     * every command so accessors / setters read the freshest signal values.
     */
    const buildCommandHost = (): ChatCommandHost | null => {
        if (!app || !plugin) return null;
        return {
            app,
            plugin,
            store,
            modelRegistry: registry,
            model: { current: currentModel, set: updateModel },
            systemPrompt: {
                current: selectedSystemPrompt,
                set: setSelectedSystemPrompt,
            },
            webSearch: {
                current: webSearchEnabled,
                set: setWebSearchEnabled,
            },
        };
    };

    /**
     * Tries to run `line` as a slash command. Returns true if it matched a
     * known command (and was executed), false if the line should be sent to
     * the model instead.
     */
    const runIfCommand = (line: string): boolean => {
        const parsed = parseCommandLine(line);
        if (!parsed) return false;
        const command = plugin?.commands?.get(parsed.name);
        if (!command) return false;
        const host = buildCommandHost();
        if (!host) return false;
        void command.run({ args: parsed.args, host });
        return true;
    };

    const listSlashItems = (query: string): SlashSuggestItem[] => {
        const commands = plugin?.commands?.list() ?? [];
        const q = query.toLowerCase();
        return commands
            .filter((c) => c.name.toLowerCase().startsWith(q))
            .slice(0, 10)
            .map((c) => ({
                name: c.name,
                description: c.description,
                parameterHint: c.parameterHint,
            }));
    };

    // The mount runs in onMount (not in ref={...}) so the host element is
    // attached to the document by the time CM6 reads
    // `parent.ownerDocument.defaultView`.
    onMount(() => {
        if (!composerHost) return;
        let handleRef: ComposerHandle | null = null;
        const handle = mountComposer({
            parent: composerHost,
            placeholder: hasModels()
                ? "Type your message... (or `/` for commands)"
                : "No models available",
            extensions: [
                slashTriggerExtension({
                    list: listSlashItems,
                    onAccept(name) {
                        if (!handleRef) return;
                        const parsed = parseCommandLine(
                            handleRef.getValue(),
                        );
                        const args = parsed?.args ?? "";
                        handleRef.setValue("");
                        const command = plugin?.commands?.get(name);
                        const host = buildCommandHost();
                        if (command && host) {
                            void command.run({ args, host });
                        }
                    },
                }),
                noteSuggestExtension(suggestProviders),
                mentionPillExtension({ onRemove: handlePillRemove }),
            ],
            onSubmit(text) {
                const trimmed = text.trim();
                if (!trimmed) return false;
                // /-commands run locally and clear the editor; they never
                // reach the model.
                if (runIfCommand(trimmed)) return true;
                if (!hasModels()) return false;
                onSubmit(
                    trimmed,
                    webSearchEnabled(),
                    selectedSystemPrompt(),
                );
                return true;
            },
        });
        handleRef = handle;
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
