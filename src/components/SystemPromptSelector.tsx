import { Component, Accessor, createSignal, useContext, onMount, createEffect, onCleanup, Show, For } from "solid-js";
import { App, TFile } from "obsidian";

import { AppContext, PluginContext } from "@/CoiChatApp";

export interface SystemPromptSelectorProps {
  selectedPrompt: Accessor<string>;
  onPromptChange: (prompt: string) => void;
}

/**
 * SystemPromptSelector component allows users to select a custom system prompt
 * from notes in the configured system prompts folder.
 * 
 * Features:
 * - Loads prompt notes from the system prompts folder defined in plugin settings
 * - Displays "None" option for no custom system prompt
 * - Automatically refreshes when settings change
 * - Selected prompt content is loaded and passed to chat requests
 */
export const SystemPromptSelector: Component<SystemPromptSelectorProps> = ({
  selectedPrompt,
  onPromptChange,
}) => {
  const app = useContext(AppContext);
  const plugin = useContext(PluginContext);
  const [prompts, setPrompts] = createSignal<{ path: string; name: string }[]>([]);

  const loadPrompts = () => {
    if (!app || !plugin) return;

    const systemPromptFolder = plugin.settings.systemPromptFolder;
    const notes = app.vault
      .getMarkdownFiles()
      .filter(
        (file) =>
          file.path.startsWith(systemPromptFolder + "/") ||
          file.path === systemPromptFolder,
      )
      .map((file) => ({
        path: file.path,
        name: file.basename,
      }));

    setPrompts(notes);
  };

  onMount(() => {
    loadPrompts();
    
    // Listen for settings changes
    if (app) {
      const eventRef = app.workspace.on("co-intelligence:settings-changed" as any, loadPrompts);
      
      onCleanup(() => {
        if (eventRef) {
          app.workspace.offref(eventRef);
        }
      });
    }
  });

  // Also reload prompts when the system prompt folder setting changes
  createEffect(() => {
    if (plugin?.settings.systemPromptFolder) {
      loadPrompts();
    }
  });

  const handlePromptChange = (event: Event) => {
    const target = event.target as HTMLSelectElement;
    onPromptChange(target.value);
  };

  return (
    <select 
      value={selectedPrompt()} 
      onChange={handlePromptChange}
      title="Select a custom system prompt from your configured prompts folder"
    >
      <option value="" selected={selectedPrompt() === ""}>None</option>
      <Show when={prompts().length === 0}>
        <option value="" disabled>No prompts available</option>
      </Show>
      <For each={prompts()}>
        {(prompt) => (
          <option value={prompt.path} selected={selectedPrompt() === prompt.path}>
            {prompt.name}
          </option>
        )}
      </For>
    </select>
  );
};