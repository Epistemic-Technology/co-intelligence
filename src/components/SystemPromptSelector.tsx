import {
  Component,
  Accessor,
  createSignal,
  useContext,
  onMount,
  createEffect,
  onCleanup,
  Show,
  For,
} from "solid-js";

import { AppContext, PluginContext } from "@/CoiChatApp";
import { LucideIcon } from "@/components/LucideIcon";

export interface SystemPromptSelectorProps {
  selectedPrompt: Accessor<string>;
  onPromptChange: (prompt: string) => void;
  label?: string;
  id?: string;
  showLabel?: boolean;
}

/**
 * SystemPromptSelector component allows users to select a custom system prompt
 * from notes in the configured system prompts folder.
 *
 * Features:
 * - Loads prompt notes from the system prompts folder defined in plugin settings
 * - Displays "No prompt" option for no custom system prompt
 * - Automatically refreshes when settings change
 * - Selected prompt content is loaded and passed to chat requests
 */
export const SystemPromptSelector: Component<SystemPromptSelectorProps> = ({
  selectedPrompt,
  onPromptChange,
  label = "Select system prompt",
  id = "system-prompt-selector",
  showLabel = false,
}) => {
  const app = useContext(AppContext);
  const plugin = useContext(PluginContext);
  const [prompts, setPrompts] = createSignal<{ path: string; name: string }[]>(
    [],
  );

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
      const eventRef = app.workspace.on(
        "co-intelligence:settings-changed",
        loadPrompts,
      );

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
    <div class="coi-system-prompt-selector">
      {showLabel ? (
        <label for={id} class="coi-system-prompt-selector-label">
          <LucideIcon name="message-circle-code" aria-hidden="true" />
          {label}
        </label>
      ) : (
        <>
          <LucideIcon name="message-circle-code" aria-hidden="true" />
          <label for={id} class="coi-sr-only">
            {label}
          </label>
        </>
      )}
      <select
        id={id}
        value={selectedPrompt()}
        onChange={handlePromptChange}
        title="Select a custom system prompt from your configured prompts folder"
        aria-label={
          prompts().length === 0 ? "No system prompts available" : undefined
        }
        aria-describedby={
          prompts().length === 0 ? `${id}-description` : undefined
        }
      >
        <option value="" selected={selectedPrompt() === ""}>
          No prompt
        </option>
        <Show when={prompts().length === 0}>
          <option value="" disabled>
            No prompts available
          </option>
        </Show>
        <For each={prompts()}>
          {(prompt) => (
            <option
              value={prompt.path}
              selected={selectedPrompt() === prompt.path}
            >
              {prompt.name}
            </option>
          )}
        </For>
      </select>
      {prompts().length === 0 && (
        <div id={`${id}-description`} class="coi-sr-only">
          No system prompts are available. Configure a system prompts folder in
          settings to add custom prompts.
        </div>
      )}
    </div>
  );
};
