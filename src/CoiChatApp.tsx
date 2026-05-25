import { Component, createContext, createEffect, on } from "solid-js";
import { App, TFile } from "obsidian";

import { ChatInterface } from "@/components/ChatInterface";
import { CoIntelligencePlugin } from "@/CoIntelligencePlugin";
import {
    createSessionStore,
    type SessionStore,
} from "@/session/session-store";
import type { Session } from "@/session/types";

export const PluginContext = createContext<CoIntelligencePlugin>();
export const AppContext = createContext<App>();
export const FileContext = createContext<TFile>();
export const SessionStoreContext = createContext<SessionStore>();

export interface AppProps {
    app: App;
    file: TFile;
    plugin: CoIntelligencePlugin;
    initialSession: Session;
    /**
     * Fires whenever the session's `updatedAt` ticks forward. Called with the
     * current store proxy — host (ChatView) reads `store.session` to persist.
     */
    onSessionChange?: (store: SessionStore) => void;
    /** Fires after each successful assistant response (post sources). */
    onAssistantResponseComplete?: () => void;
}

export const CoiChatApp: Component<AppProps> = (props) => {
    const store = createSessionStore(props.initialSession);

    if (props.onSessionChange) {
        createEffect(
            on(
                () => store.session.updatedAt,
                () => props.onSessionChange?.(store),
                { defer: true },
            ),
        );
    }

    return (
        <div class="coi-app">
            <AppContext.Provider value={props.app}>
                <FileContext.Provider value={props.file}>
                    <PluginContext.Provider value={props.plugin}>
                        <SessionStoreContext.Provider value={store}>
                            <ChatInterface
                                store={store}
                                onAssistantResponseComplete={
                                    props.onAssistantResponseComplete
                                }
                            />
                        </SessionStoreContext.Provider>
                    </PluginContext.Provider>
                </FileContext.Provider>
            </AppContext.Provider>
        </div>
    );
};
