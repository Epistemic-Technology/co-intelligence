import { TFile, App } from "obsidian";
import { For, Accessor, Setter } from "solid-js";
import { NoteLink } from "@/components/NoteLink";
import { AddContextMenu } from "@/components/AddContextMenu";
import { ContextItems, Source, Tag } from "@/types";

export interface ContextListProps {
  app: App;
  contextItems: Accessor<ContextItems | null>;
  setContextItems: Setter<ContextItems | null>;
  onAddNote: (file: TFile) => void;
  onAddTag: (tag: Tag) => void;
}

export const ContextList = ({
  app,
  contextItems,
  setContextItems,
  onAddNote,
  onAddTag,
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

  const handleKeyDown = (
    event: KeyboardEvent,
    type: 'note' | 'tag',
    item: TFile | Tag
  ) => {
    if (event.key === 'x' || event.key === 'Delete') {
      event.preventDefault();
      if (type === 'note') {
        handleRemoveNote(item as TFile);
      } else {
        handleRemoveTag(item as Tag);
      }
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (type === 'note') {
        // Open the note file
        app.workspace.openLinkText((item as TFile).basename, "");
      } else {
        // Simulate clicking the tag link
        window.open(`obsidian://search?query=${encodeURIComponent(item as Tag)}`, '_blank');
      }
    }
  };

  return (
    <div class="coi-linked-notes coi-context-box">
      <details open>
        <summary>Context</summary>
        <ul class="coi-context-box-context-list">
          <For each={contextItems()?.notes}>
            {(note) => (
              <li
                tabindex="0"
                class="coi-context-item"
                onKeyDown={(e) => handleKeyDown(e, 'note', note)}
                aria-label={`Note: ${note.basename}. Press Enter to open, x or Delete to remove.`}
              >
                <NoteLink href="#" tabindex="-1">{note.basename}</NoteLink>
                <button
                  class="coi-context-box-remove-button"
                  onClick={() => handleRemoveNote(note)}
                  tabindex="-1"
                  aria-label="Remove note"
                >
                  x
                </button>
              </li>
            )}
          </For>
          <For each={contextItems()?.tags}>
            {(tag) => (
              <li
                tabindex="0"
                class="coi-context-item"
                onKeyDown={(e) => handleKeyDown(e, 'tag', tag)}
                aria-label={`Tag: ${tag}. Press Enter to search, x or Delete to remove.`}
              >
                <a
                  href={`obsidian://search?query=${encodeURIComponent(tag)}`}
                  class="tag"
                  target="_blank"
                  rel="noopener nofollow"
                  tabindex="-1"
                >
                  {`${tag}`}
                </a>
                <button
                  class="coi-context-box-remove-button"
                  onClick={() => handleRemoveTag(tag)}
                  tabindex="-1"
                  aria-label="Remove tag"
                >
                  x
                </button>
              </li>
            )}
          </For>
        </ul>
      </details>
      <AddContextMenu app={app} onAddNote={onAddNote} onAddTag={onAddTag} />
    </div>
  );
};
