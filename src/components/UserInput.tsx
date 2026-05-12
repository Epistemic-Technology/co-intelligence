import {
  Component,
  Accessor,
  createSignal,
  createEffect,
  useContext,
  Show,
} from "solid-js";
import { TFile } from "obsidian";

import { ModelSelector } from "@/components/ModelSelector";
import { SystemPromptSelector } from "@/components/SystemPromptSelector";
import { NoteLinkSuggestionModal } from "@/components/NoteLinkSuggestionModal";
import { TagSuggestionModal } from "@/components/TagSuggestionModal";
import { AppContext, PluginContext } from "@/CoiChatApp";
import { ModelRegistry } from "@/services/model-registry";
import { Model, Tag } from "@/types";

export interface UserInputProps {
  onSubmit: (
    value: string,
    webSearchEnabled: boolean,
    systemPrompt?: string,
  ) => void;
  currentModel: Accessor<Model | null>;
  updateModel: (model: Model | null) => void;
  onLinkNote?: (file: TFile) => void;
  onAddTag?: (tag: Tag) => void;
  initialSystemPrompt?: string;
}

export const UserInput: Component<UserInputProps> = ({
  onSubmit,
  currentModel,
  updateModel,
  onLinkNote,
  onAddTag,
  initialSystemPrompt = "",
}) => {
  let textareaRef: HTMLTextAreaElement | undefined;
  const app = useContext(AppContext);
  const plugin = useContext(PluginContext);
  const registry = ModelRegistry.getInstance(plugin);
  const hasModels = () => registry.availableModels.length > 0;

  // Add effect to auto-focus the textarea when component mounts
  createEffect(() => {
    if (textareaRef) {
      textareaRef.focus();
    }
  });

  /**
   * Tracks whether a suggestion modal (wikilink or tag) is currently open
   * Prevents multiple modals from opening simultaneously
   */
  const [isModalOpen, setIsModalOpen] = createSignal(false);

  const [webSearchEnabled, setWebSearchEnabled] = createSignal(false);
  const [selectedSystemPrompt, setSelectedSystemPrompt] =
    createSignal(initialSystemPrompt);

  /**
   * Handles input in the textarea, detecting wiki links, tags, and showing suggestions
   * - Adds closing brackets when [[ is typed
   * - Shows suggestion modals for wikilinks and tags
   */
  const handleInput = () => {
    if (!textareaRef || !app || isModalOpen()) return;

    const value = textareaRef.value;
    const caretPos = textareaRef.selectionStart;

    // Detect if user just typed [[ to auto-complete with closing brackets
    if (caretPos >= 2 && value.substring(caretPos - 2, caretPos) === "[[") {
      // Add closing ]] brackets automatically
      const newValue =
        value.substring(0, caretPos) + "]]" + value.substring(caretPos);
      textareaRef.value = newValue;

      // Keep cursor position between brackets
      textareaRef.setSelectionRange(caretPos, caretPos);

      setIsModalOpen(true);
      const modal = new NoteLinkSuggestionModal(app, "", (file) => {
        handleNoteSelect(file);
        setIsModalOpen(false);
      });
      modal.open();

      modal.onClose = () => {
        setIsModalOpen(false);
      };
    }

    // Detect if user just typed # with nothing to the right
    if (
      caretPos >= 1 &&
      value.substring(caretPos - 1, caretPos) === "#" &&
      (caretPos === value.length || /\s/.test(value.charAt(caretPos)))
    ) {
      setIsModalOpen(true);
      const modal = new TagSuggestionModal(app, "", (tag) => {
        handleTagSelect(tag);
        setIsModalOpen(false);
      });
      modal.open();

      modal.onClose = () => {
        setIsModalOpen(false);
      };
    }

    // Check if cursor is inside a wikilink
    const textBeforeCaret = value.substring(0, caretPos);
    const lastOpenBracket = textBeforeCaret.lastIndexOf("[[");
    const textAfterCaret = value.substring(caretPos);
    const nextCloseBracket = textAfterCaret.indexOf("]]");

    // If we're inside a wikilink and not already showing the modal
    if (
      lastOpenBracket !== -1 &&
      nextCloseBracket !== -1 &&
      lastOpenBracket + 2 <= caretPos && // Cursor after [[
      caretPos <= textBeforeCaret.length + nextCloseBracket && // Cursor before ]]
      !isModalOpen()
    ) {
      const query = textBeforeCaret.substring(lastOpenBracket + 2);
      setIsModalOpen(true);
      const modal = new NoteLinkSuggestionModal(app, query, (file) => {
        handleNoteSelect(file);
        setIsModalOpen(false);
      });
      modal.open();

      modal.onClose = () => {
        setIsModalOpen(false);
      };
    }

    // Check if cursor is immediately after a # with no text to the right
    if (!isModalOpen()) {
      const lastHashBeforeCaret = textBeforeCaret.lastIndexOf("#");
      if (
        lastHashBeforeCaret !== -1 &&
        lastHashBeforeCaret === caretPos - 1 &&
        (caretPos === value.length || /\s/.test(value.charAt(caretPos)))
      ) {
        setIsModalOpen(true);
        const modal = new TagSuggestionModal(app, "", (tag) => {
          handleTagSelect(tag);
          setIsModalOpen(false);
        });
        modal.open();

        modal.onClose = () => {
          setIsModalOpen(false);
        };
      }
    }
  };

  /**
   * Handles keyboard events in the textarea
   * - Submit on Enter (unless Shift is held or modal is open)
   */
  const handleKeyDown = (event: KeyboardEvent) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      textareaRef &&
      !isModalOpen()
    ) {
      event.preventDefault();
      onSubmit(textareaRef.value, webSearchEnabled(), selectedSystemPrompt());
      textareaRef.value = "";
    }
  };

  /**
   * Handles when a note is selected from the suggestion modal
   * - Inserts the note title as a wikilink at the cursor position
   * - Replaces any existing text between [[ and ]]
   * - Positions cursor after the wikilink
   * - Calls onLinkNote callback if provided
   */
  const handleNoteSelect = (file: TFile) => {
    if (!textareaRef) return;

    const value = textareaRef.value;
    const caretPos = textareaRef.selectionStart;

    const textBeforeCaret = value.substring(0, caretPos);
    const lastOpenBracket = textBeforeCaret.lastIndexOf("[[");

    const textAfterCaret = value.substring(caretPos);
    const nextCloseBracket = textAfterCaret.indexOf("]]");

    // Replace the content between [[ and ]]
    const newValue =
      value.substring(0, lastOpenBracket + 2) +
      file.basename +
      (nextCloseBracket !== -1
        ? value.substring(caretPos + nextCloseBracket)
        : "]]" + value.substring(caretPos));

    textareaRef.value = newValue;

    // Position cursor after the inserted wikilink
    const newCursorPos = lastOpenBracket + file.basename.length + 4; // 4 for [[ and ]]
    textareaRef.setSelectionRange(newCursorPos, newCursorPos);

    textareaRef.focus();

    if (onLinkNote) {
      onLinkNote(file);
    }
  };

  /**
   * Handles when a tag is selected from the suggestion modal
   * - Inserts the tag at the cursor position, replacing the # if needed
   * - Positions cursor after the inserted tag
   */
  const handleTagSelect = (tag: Tag) => {
    if (!textareaRef) return;

    const value = textareaRef.value;
    const caretPos = textareaRef.selectionStart;

    const textBeforeCaret = value.substring(0, caretPos);
    const lastHashPosition = textBeforeCaret.lastIndexOf("#");

    // Replace the # with the selected tag (which already includes #)
    const newValue =
      value.substring(0, lastHashPosition) + tag + value.substring(caretPos);

    textareaRef.value = newValue;

    const newCursorPos = lastHashPosition + tag.length;
    textareaRef.setSelectionRange(newCursorPos, newCursorPos);

    textareaRef.focus();

    if (onAddTag) {
      onAddTag(tag);
    }
  };

  const toggleWebSearchEnabled = () => {
    setWebSearchEnabled(!webSearchEnabled());
  };

  return (
    <div class="coi-user-input">
      <textarea
        ref={textareaRef}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        rows={4}
        disabled={!hasModels()}
        placeholder={
          hasModels() ? "Type your message..." : "No models available"
        }
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
