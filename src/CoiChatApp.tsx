import { Component, Context, createContext } from "solid-js";
import { CoreMessage } from "ai";
import { App, TFile } from "obsidian";

import { ChatInterface } from "@/components/ChatInterface";
import { CoIntelligencePlugin } from "@/CoIntelligencePlugin";
import { ContextItems, Source } from "@/types";

export const PluginContext = createContext<CoIntelligencePlugin>();
export const AppContext = createContext<App>();
export const FileContext = createContext<TFile>();

export interface AppProps {
  app: App;
  file: TFile;
  plugin: CoIntelligencePlugin;
  onChange: (
    messages: CoreMessage[],
    title: string,
    contextItems: ContextItems | null,
    sources?: Source[],
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
            <ChatInterface
              initialMessages={initialMessages}
              initialContext={initialContext}
              initialSources={initialSources}
              onChange={props => onChange(props.newMessages, props.newTitle, props.contextItems, props.sources)}
            />
          </PluginContext.Provider>
        </FileContext.Provider>
      </AppContext.Provider>
    </div>
  );
};
