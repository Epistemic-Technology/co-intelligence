import { TFile } from "obsidian";
import { For, Accessor, Setter } from "solid-js";
import { NoteLink } from "@/components/NoteLink";
import { ContextItems, Source, Tag } from "@/types";

export interface ContextListProps {
  contextItems: Accessor<ContextItems | null>;
  setContextItems: Setter<ContextItems | null>;
}

export const ContextList = ({
  contextItems,
  setContextItems,
}: ContextListProps) => {
  const handleRemoveNote = (note: TFile) => {
    setContextItems((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        notes: prev.notes.filter((n) => n.basename !== note.basename),
      };
    });
  };

  const handleRemoveTag = (tag: Tag) => {
    setContextItems((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tags: prev.tags.filter((t) => t !== tag),
      };
    });
  };

  return (
    <div class="coi-linked-notes coi-context-box">
      <details open>
        <summary>Context</summary>
        <ul>
          <For each={contextItems()?.notes}>
            {(note) => (
              <li>
                <NoteLink href="#">{note.basename}</NoteLink>
                <button
                  class="coi-context-box-remove-button"
                  onClick={() => handleRemoveNote(note)}
                >
                  x
                </button>
              </li>
            )}
          </For>
          <For each={contextItems()?.tags}>
            {(tag) => (
              <li>
                <a
                  href={`obsidian://search?query=${encodeURIComponent(tag)}`}
                  class="tag"
                  target="_blank"
                  rel="noopener nofollow"
                >
                  {`${tag}`}
                </a>
                <button
                  class="coi-context-box-remove-button"
                  onClick={() => handleRemoveTag(tag)}
                >
                  x
                </button>
              </li>
            )}
          </For>
        </ul>
      </details>
      <button
        aria-label="Add context"
        title="Add context to note"
        type="button"
        class="coi-user-input-add-context-button"
      >
        +
      </button>
    </div>
  );
};
