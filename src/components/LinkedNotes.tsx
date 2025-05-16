import { TFile } from "obsidian";
import { For, Accessor } from "solid-js";
import { NoteLink } from "@/components/NoteLink";

export const LinkedNotes = ({ notes }: { notes: Accessor<TFile[]> }) => {
  return (
    <div class="coi-linked-notes coi-context-box">
      <details open>
        <summary>Linked Notes</summary>
        <ul>
          <For each={notes()}>
            {(note) => (
              <li>
                <NoteLink href="#">{note.basename}</NoteLink>
              </li>
            )}
          </For>
        </ul>
      </details>
    </div>
  );
};
