import { TFile } from "obsidian";
import { For, Accessor } from "solid-js";
import { NoteLink } from "@/components/NoteLink";
import { ContextItems, Source, Tag } from "@/types";

export interface ContextListProps {
  contextItems: Accessor<ContextItems | null>;
}

export const ContextList = ({ contextItems }: ContextListProps) => {
  return (
    <div class="coi-linked-notes coi-context-box">
      <details open>
        <summary>Context</summary>
        <ul>
          <For each={contextItems()?.notes}>
            {(note) => (
              <li>
                <NoteLink href="#">{note.basename}</NoteLink>
                <button>X</button>
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
                <button>X</button>
              </li>
            )}
          </For>
        </ul>
      </details>
    </div>
  );
};
