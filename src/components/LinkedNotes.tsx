import { TFile } from "obsidian";
import { For } from "solid-js";
import { NoteLink } from "@/components/NoteLink";

export const LinkedNotes = ({
  notes,
  handleRemoveLink,
}: {
  notes: TFile[];
  handleRemoveLink: (note: TFile) => void;
}) => {
  return (
    <div class="coi-linked-notes coi-context-box">
      <h4>Linked Notes:</h4>
      <ul>
        <For each={notes}>
          {(note) => (
            <li>
              <NoteLink href="#">{note.basename}</NoteLink>
              <button
                class="coi-remove-link"
                onClick={() => handleRemoveLink(note)}
              >
                &times;
              </button>
            </li>
          )}
        </For>
      </ul>
    </div>
  );
};
