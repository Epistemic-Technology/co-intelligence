import { createMemo, createSignal, useContext, Show } from "solid-js";
import { TFile } from "obsidian";

import { ModelRegistry } from "@/services/model-registry";
import { ContextItems, Model, Tag } from "@/types";
import { AppContext, PluginContext } from "@/CoiChatApp";
import { ChatHistory } from "@/components/ChatHistory";
import { SessionSettingsHeader } from "@/components/SessionSettingsHeader";
import { UserInput } from "@/components/UserInput";
import { ContextList } from "@/components/ContextList";
import { SourceList } from "@/components/SourceList";

import { useChatController } from "@/chat/use-chat-controller";
import type { SessionStore } from "@/session/session-store";
import type { SerializedContextItems } from "@/session/types";

export interface ChatInterfaceProps {
    store: SessionStore;
    onAssistantResponseComplete?: () => void;
}

export const ChatInterface = (props: ChatInterfaceProps) => {
    const plugin = useContext(PluginContext);
    if (!plugin) {
        throw new Error("Plugin Context is not available");
    }
    const app = useContext(AppContext);
    if (!app) {
        throw new Error("App Context is not available");
    }

    const registry = ModelRegistry.getInstance(plugin);
    const defaultModel = plugin.settings.defaultModel
        ? registry.getModel(plugin.settings.defaultModel)
        : registry.getDefaultModel();

    const [model, setModel] = createSignal<Model | null>(defaultModel);

    // Derive the TFile-backed UI shape from the path-backed session shape.
    const contextItems = createMemo<ContextItems | null>(() => {
        const ser = props.store.session.contextItems;
        if (
            ser.notes.length === 0 &&
            ser.tags.length === 0 &&
            ser.sources.length === 0
        ) {
            return null;
        }
        return {
            notes: ser.notes
                .map((p) => app.vault.getAbstractFileByPath(p))
                .filter((f): f is TFile => f instanceof TFile),
            tags: ser.tags,
            sources: ser.sources,
        };
    });

    const updateSerialized = (
        mutate: (prev: SerializedContextItems) => SerializedContextItems,
    ) => {
        const next = mutate(props.store.session.contextItems);
        props.store.setContextItems(next);
    };

    const handleLinkNote = (file: TFile) =>
        updateSerialized((prev) =>
            prev.notes.includes(file.path)
                ? prev
                : { ...prev, notes: [...prev.notes, file.path] },
        );

    const handleAddTag = (tag: Tag) =>
        updateSerialized((prev) =>
            prev.tags.includes(tag)
                ? prev
                : { ...prev, tags: [...prev.tags, tag] },
        );

    const handleRemoveNote = (file: TFile) =>
        updateSerialized((prev) => ({
            ...prev,
            notes: prev.notes.filter((p) => p !== file.path),
        }));

    const handleRemoveTag = (tag: Tag) =>
        updateSerialized((prev) => ({
            ...prev,
            tags: prev.tags.filter((t) => t !== tag),
        }));

    const controller = useChatController({
        app,
        plugin,
        registry,
        model,
        contextItems,
        store: props.store,
        tools: plugin.tools,
        permissionBroker: plugin.permissionBroker,
        onAssistantResponseComplete: props.onAssistantResponseComplete,
    });

    const messages = createMemo(() =>
        props.store.session.messages.filter(
            (m) => m.role === "user" || m.role === "assistant",
        ),
    );

    const sources = createMemo(() => props.store.session.sources);

    return (
        <div>
            <SessionSettingsHeader store={props.store} />
            <ChatHistory
                messages={messages}
                isProcessing={controller.isProcessing}
                currentStep={controller.currentStep}
                maxSteps={controller.maxSteps}
                onCancelRequest={controller.cancel}
            />
            <Show when={sources().length > 0}>
                <SourceList sources={sources} />
            </Show>
            <ContextList
                app={app}
                contextItems={contextItems}
                onAddNote={handleLinkNote}
                onAddTag={handleAddTag}
                onRemoveNote={handleRemoveNote}
                onRemoveTag={handleRemoveTag}
            />
            <UserInput
                onSubmit={(msg, ws, sp) => void controller.send(msg, ws, sp)}
                currentModel={model}
                updateModel={setModel}
                onLinkNote={handleLinkNote}
                onRemoveNote={handleRemoveNote}
                onAddTag={handleAddTag}
                onRemoveTag={handleRemoveTag}
                store={props.store}
                initialSystemPrompt={
                    plugin.settings.defaultSystemPromptNote || ""
                }
            />
        </div>
    );
};
