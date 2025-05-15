import {
  Component,
  Accessor,
  createSignal,
  createEffect,
  useContext,
} from "solid-js";
import { ModelSelector, ModelSelectorProps } from "./ModelSelector";
import { Model, ModelRegistry } from "@/services/model-registry";
import { NoteLinkSuggestion } from "./NoteLinkSuggestion";
import { AppContext, PluginContext } from "@/CoiChatApp";
import { TFile } from "obsidian";

export interface UserInputProps {
  onSubmit: (value: string) => void;
  currentModel: Accessor<Model | null>;
  updateModel: (model: Model | null) => void;
  onLinkNote?: (file: TFile) => void;
}

export const UserInput: Component<UserInputProps> = ({
  onSubmit,
  currentModel,
  updateModel,
  onLinkNote,
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

  const [isWikilinkOpen, setIsWikilinkOpen] = createSignal(false);
  const [wikilinkQuery, setWikilinkQuery] = createSignal("");
  const [cursorPosition, setCursorPosition] = createSignal({ x: 0, y: 0 });
  const [caretPosition, setCaretPosition] = createSignal(0);

  // Check for [[ as user types
  const handleInput = () => {
    if (!textareaRef) return;

    const value = textareaRef.value;
    const caretPos = textareaRef.selectionStart;
    setCaretPosition(caretPos);

    // Look for [[ before the cursor
    if (caretPos >= 2 && value.substring(caretPos - 2, caretPos) === "[[") {
      const textBeforeCaret = value.substring(0, caretPos);
      const lines = textBeforeCaret.split("\n");
      const currentLine = lines[lines.length - 1];

      const rect = textareaRef.getBoundingClientRect();
      const lineHeight =
        parseInt(getComputedStyle(textareaRef).lineHeight) || 20;

      const x = rect.left + 5 + currentLine.length * 8; // Approximate character width
      const y = rect.top + lines.length * lineHeight;

      setCursorPosition({ x, y });
      setIsWikilinkOpen(true);
      setWikilinkQuery("");
    }
    // User is typing inside a wikilink
    else if (isWikilinkOpen()) {
      const textBeforeCaret = value.substring(0, caretPos);
      const lastOpenBracket = textBeforeCaret.lastIndexOf("[[");
      const lastCloseBracket = textBeforeCaret.lastIndexOf("]]");

      if (lastOpenBracket > lastCloseBracket) {
        const query = textBeforeCaret.substring(lastOpenBracket + 2);
        setWikilinkQuery(query);
      } else {
        setIsWikilinkOpen(false);
      }
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      textareaRef &&
      !isWikilinkOpen()
    ) {
      event.preventDefault();
      onSubmit(textareaRef.value);
      textareaRef.value = "";
    } else if (event.key === "Escape" && isWikilinkOpen()) {
      event.preventDefault();
      setIsWikilinkOpen(false);
    }
  };

  const handleNoteSelect = (file: TFile) => {
    if (!textareaRef) return;

    const value = textareaRef.value;
    const caretPos = caretPosition();

    const textBeforeCaret = value.substring(0, caretPos);
    const lastOpenBracket = textBeforeCaret.lastIndexOf("[[");

    const newValue =
      value.substring(0, lastOpenBracket) +
      "[[" +
      file.basename +
      "]]" +
      value.substring(caretPos);

    textareaRef.value = newValue;

    const newCursorPos = lastOpenBracket + file.basename.length + 4; // 4 for [[ and ]]
    textareaRef.setSelectionRange(newCursorPos, newCursorPos);

    setIsWikilinkOpen(false);

    if (onLinkNote) {
      onLinkNote(file);
    }
  };

  return (
    <div class="coi-user-input">
      <textarea
        ref={textareaRef}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        rows={4}
        disabled={!hasModels()}
        placeholder={hasModels() ? "Type your message..." : "No models available"}
      />
      {app && (
        <NoteLinkSuggestion
          app={app}
          query={wikilinkQuery()}
          position={cursorPosition()}
          onSelect={handleNoteSelect}
          onClose={() => setIsWikilinkOpen(false)}
          isOpen={isWikilinkOpen()}
        />
      )}
      <div class="coi-user-input-options">
        <ModelSelector
          selectedModel={currentModel}
          onModelChange={updateModel}
        />
      </div>
    </div>
  );
};
