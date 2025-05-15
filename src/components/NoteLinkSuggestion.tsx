import {
  Component,
  createSignal,
  createEffect,
  onCleanup,
  Show,
} from "solid-js";
import { App, TFile } from "obsidian";
import { createStore } from "solid-js/store";

export interface NoteLinkSuggestionProps {
  app: App;
  query: string;
  position: { x: number; y: number };
  onSelect: (file: TFile) => void;
  onClose: () => void;
  isOpen: boolean;
}

export const NoteLinkSuggestion: Component<NoteLinkSuggestionProps> = (
  props,
) => {
  const [notes, setNotes] = createStore<TFile[]>([]);
  const [selectedIndex, setSelectedIndex] = createSignal(0);

  createEffect(() => {
    if (!props.isOpen || !props.query) {
      setNotes([]);
      return;
    }

    const files = props.app.vault.getMarkdownFiles();
    const filteredNotes = files
      .filter((file) =>
        file.basename.toLowerCase().includes(props.query.toLowerCase()),
      )
      .slice(0, 10); // Limit to 10 results

    setNotes(filteredNotes);
    setSelectedIndex(0);
  });

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!props.isOpen) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % notes.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + notes.length) % notes.length);
        break;
      case "Enter":
        e.preventDefault();
        if (notes.length > 0) {
          props.onSelect(notes[selectedIndex()]);
        }
        break;
      case "Escape":
        e.preventDefault();
        props.onClose();
        break;
    }
  };

  createEffect(() => {
    if (props.isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    } else {
      document.removeEventListener("keydown", handleKeyDown);
    }
  });

  onCleanup(() => {
    document.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <Show when={props.isOpen && notes.length > 0}>
      <div
        class="coi-note-suggestion-container"
        style={{
          position: "absolute",
          left: `${props.position.x}px`,
          top: `${props.position.y}px`,
          "z-index": 1000,
          background: "var(--background-primary)",
          border: "1px solid var(--background-modifier-border)",
          "border-radius": "4px",
          "box-shadow": "0 2px 8px var(--background-modifier-box-shadow)",
          width: "300px",
          "max-height": "200px",
          overflow: "auto",
        }}
      >
        <ul
          class="coi-note-suggestion-list"
          style={{ "list-style": "none", padding: "0.5rem", margin: 0 }}
        >
          {notes.map((note, index) => (
            <li
              class="coi-note-suggestion-item"
              classList={{ "coi-selected": index === selectedIndex() }}
              style={{
                padding: "0.5rem",
                cursor: "pointer",
                "background-color":
                  index === selectedIndex()
                    ? "var(--background-modifier-hover)"
                    : "transparent",
              }}
              onClick={() => props.onSelect(note)}
            >
              {note.basename}
            </li>
          ))}
        </ul>
      </div>
    </Show>
  );
};
