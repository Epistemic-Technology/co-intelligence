import { Component, Context, createContext } from "solid-js";
import { ModelChatMessage } from "@/types";
import { App, TFile } from "obsidian";

import { ChatInterface } from "@/components/ChatInterface";
import { CoIntelligencePlugin } from "@/CoIntelligencePlugin";
import { ContextItems, Source } from "@/types";
import { HandleChatChangeProps } from "@/ChatView";

export const PluginContext = createContext<CoIntelligencePlugin>();
export const AppContext = createContext<App>();
export const FileContext = createContext<TFile>();

export interface AppProps {
  app: App;
  file: TFile;
  plugin: CoIntelligencePlugin;
  onChange: (props: HandleChatChangeProps) => void;
  initialMessages: ModelChatMessage[];
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
  return (
    <div class="coi-app">
      <AppContext.Provider value={app}>
        <FileContext.Provider value={file}>
          <PluginContext.Provider value={plugin}>
            <ChatInterface
              initialMessages={initialMessages}
              initialContext={initialContext}
              initialSources={initialSources}
              onChange={onChange}
            />
          </PluginContext.Provider>
        </FileContext.Provider>
      </AppContext.Provider>
    </div>
  );
};
