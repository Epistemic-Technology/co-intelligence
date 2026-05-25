import { createSignal, useContext, Show } from "solid-js";
import { TFile } from "obsidian";

import { ModelRegistry } from "@/services/model-registry";
import { Source, Model, ContextItems, Tag, ModelChatMessage } from "@/types";
import { PluginContext, AppContext } from "@/CoiChatApp";
import { ChatHistory } from "@/components/ChatHistory";
import { UserInput } from "@/components/UserInput";
import { ContextList } from "@/components/ContextList";
import { SourceList } from "@/components/SourceList";

import {
    addNoteToContext,
    addTagToContext,
} from "@/chat/context-actions";
import { useChatController } from "@/chat/use-chat-controller";
import { HandleChatChangeProps } from "@/ChatView";

export interface ChatInterfaceProps {
    initialMessages: ModelChatMessage[];
    initialContext?: ContextItems | null;
    initialSources?: Source[];
    onChange?: (props: HandleChatChangeProps) => void;
}

export const ChatInterface = ({
    initialMessages,
    initialContext = null,
    initialSources = [],
    onChange,
}: ChatInterfaceProps) => {
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
    const [contextItems, setContextItems] =
        createSignal<ContextItems | null>(initialContext);

    const controller = useChatController({
        app,
        plugin,
        registry,
        model,
        contextItems,
        initialMessages,
        initialSources,
        onChange,
    });

    const handleLinkNote = (file: TFile) =>
        setContextItems(addNoteToContext(contextItems(), file));

    const handleAddTag = (tag: Tag) =>
        setContextItems(addTagToContext(contextItems(), tag));

    return (
        <div>
            <ChatHistory
                messages={controller.messages}
                isProcessing={controller.isProcessing}
                onCancelRequest={controller.cancel}
            />
            <Show when={controller.sources().length > 0}>
                <SourceList sources={controller.sources} />
            </Show>
            <ContextList
                app={app}
                contextItems={contextItems}
                setContextItems={setContextItems}
                onAddNote={handleLinkNote}
                onAddTag={handleAddTag}
            />
            <UserInput
                onSubmit={(msg, ws, sp) => void controller.send(msg, ws, sp)}
                currentModel={model}
                updateModel={setModel}
                onLinkNote={handleLinkNote}
                onAddTag={handleAddTag}
                initialSystemPrompt={
                    plugin.settings.defaultSystemPromptNote || ""
                }
            />
        </div>
    );
};
