import { TFile, App, getIcon } from "obsidian";
import {
  For,
  Show,
  Accessor,
  Setter,
  createSignal,
  createEffect,
} from "solid-js";
import { NoteLink } from "@/components/NoteLink";
import { AddContextMenu } from "@/components/AddContextMenu";
import { ContextItems, Source, Tag } from "@/types";
import { contextTokenEstimate } from "@/utils/model-context";

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
  const [tokenCount, setTokenCount] = createSignal<number>(0);

  createEffect(async () => {
    const items = contextItems();
    if (items) {
      const count = await contextTokenEstimate(items, app);
      setTokenCount(Math.round(count));
    } else {
      setTokenCount(0);
    }
  });

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
    type: "note" | "tag",
    item: TFile | Tag,
  ) => {
    if (event.key === "x" || event.key === "Delete") {
      event.preventDefault();
      if (type === "note") {
        handleRemoveNote(item as TFile);
      } else {
        handleRemoveTag(item as Tag);
      }
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (type === "note") {
        // Open the note file
        app.workspace.openLinkText((item as TFile).basename, "");
      } else {
        // Simulate clicking the tag link
        window.open(
          `obsidian://search?query=${encodeURIComponent(item as Tag)}`,
          "_blank",
        );
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
                onKeyDown={(e) => handleKeyDown(e, "note", note)}
                aria-label={`Note: ${note.basename}. Press Enter to open, x or Delete to remove.`}
              >
                <NoteLink href={note.basename}>{note.basename}</NoteLink>
                <button
                  class="coi-context-box-remove-button"
                  onClick={() => handleRemoveNote(note)}
                  tabindex="-1"
                  aria-label="Remove note"
                >
                  {getIcon("x")}
                </button>
              </li>
            )}
          </For>
          <For each={contextItems()?.tags}>
            {(tag) => (
              <li
                tabindex="0"
                class="coi-context-item"
                onKeyDown={(e) => handleKeyDown(e, "tag", tag)}
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
                  {getIcon("x")}
                </button>
              </li>
            )}
          </For>
        </ul>
        <Show
          when={
            contextItems() &&
            (contextItems()!.notes.length > 0 ||
              contextItems()!.tags.length > 0 ||
              contextItems()!.sources.length > 0)
          }
        >
          <div class="coi-token-estimate">
            Estimated context tokens: {tokenCount().toLocaleString()}
          </div>
        </Show>
      </details>
      <AddContextMenu app={app} onAddNote={onAddNote} onAddTag={onAddTag} />
    </div>
  );
};
