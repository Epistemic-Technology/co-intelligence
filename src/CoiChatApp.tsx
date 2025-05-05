import { Component, createContext } from "solid-js";
import { CoreMessage } from "ai";
import { App, TFile } from "obsidian";

import { ChatInterface } from "@/components/ChatInterface";
import { CoIntelligencePlugin } from "@/CoIntelligencePlugin";

export const PluginContext = createContext<CoIntelligencePlugin>();
export const AppContext = createContext<App>();
export const FileContext = createContext<TFile>();
export const ChangeCallbackContext =
  createContext<(messages: CoreMessage[]) => void>();

export interface AppProps {
  app: App;
  file: TFile;
  plugin: CoIntelligencePlugin;
  onChange: (messages: CoreMessage[]) => void;
  initialMessages: CoreMessage[];
}

export const CoiChatApp: Component<AppProps> = ({
  app,
  file,
  plugin,
  onChange,
  initialMessages,
}) => {
  return (
    <div class="coi-app">
      <AppContext.Provider value={app}>
        <FileContext.Provider value={file}>
          <PluginContext.Provider value={plugin}>
            <ChangeCallbackContext.Provider value={onChange}>
              <ChatInterface initialMessages={initialMessages} />
            </ChangeCallbackContext.Provider>
          </PluginContext.Provider>
        </FileContext.Provider>
      </AppContext.Provider>
    </div>
  );
};
