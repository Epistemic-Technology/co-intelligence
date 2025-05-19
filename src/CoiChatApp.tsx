import { Component, Context, createContext } from "solid-js";
import { CoreMessage } from "ai";
import { App, TFile } from "obsidian";

import { ChatInterface } from "@/components/ChatInterface";
import { CoIntelligencePlugin } from "@/CoIntelligencePlugin";
import { ContextItems, Source } from "@/types";

export const PluginContext = createContext<CoIntelligencePlugin>();
export const AppContext = createContext<App>();
export const FileContext = createContext<TFile>();
export const ChangeCallbackContext =
  createContext<
    (
      messages: CoreMessage[],
      title: string,
      contextItems: ContextItems | null,
      sources?: Source[],
    ) => void
  >();

export interface AppProps {
  app: App;
  file: TFile;
  plugin: CoIntelligencePlugin;
  onChange: (
    messages: CoreMessage[],
    title: string,
    contextItems: ContextItems | null,
  ) => void;
  initialMessages: CoreMessage[];
  initialContext: ContextItems | null;
  initialSources?: Source[];
}

export const CoiChatApp: Component<AppProps> = ({
  app,
  file,
  plugin,
  onChange,
  initialMessages,
  initialContext = { notes: [], tags: [], sources: [] },
  initialSources = [],
}) => {
  console.log("CoiChatApp");
  return (
    <div class="coi-app">
      <AppContext.Provider value={app}>
        <FileContext.Provider value={file}>
          <PluginContext.Provider value={plugin}>
            <ChangeCallbackContext.Provider value={onChange}>
              <ChatInterface
                initialMessages={initialMessages}
                initialContext={initialContext}
                initialSources={initialSources}
              />
            </ChangeCallbackContext.Provider>
          </PluginContext.Provider>
        </FileContext.Provider>
      </AppContext.Provider>
    </div>
  );
};
