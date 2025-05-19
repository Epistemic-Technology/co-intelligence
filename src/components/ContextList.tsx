import { TFile } from "obsidian";
import { For, Accessor } from "solid-js";
import { NoteLink } from "@/components/NoteLink";
import { ContextItems, Source, Tag } from "@/types";

export interface ContextListProps {
  contextItems: Accessor<ContextItems | null>;
}

export const ContextList = ({ contextItems }: ContextListProps) => {
  const items = contextItems();
  if (!items) return null;
  const { notes, tags, sources } = items;
  if (notes.length === 0 && tags.length === 0 && sources.length === 0) {
    return null;
  }
  return (
    <div class="coi-linked-notes coi-context-box">
      <details open>
        <summary>Context</summary>
        <ul>
          <For each={notes}>
            {(note) => (
              <li>
                <NoteLink href="#">{note.basename}</NoteLink>
                <button>X</button>
              </li>
            )}
          </For>
          <For each={tags}>
            {(tag) => (
              <li>
                <a href="#" class="internal-link" data-href={`tag:${tag}`}>
                  {`#${tag}`}
                </a>
                <button>X</button>
              </li>
            )}
          </For>
        </ul>
      </details>
    </div>
  );
};
