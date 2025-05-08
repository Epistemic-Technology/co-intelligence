import { TFile } from "obsidian";

import { NoteLink } from "@/components/NoteLink";

export const LinkedNotes = ({
  notes,
  handleRemoveLink,
}: {
  notes: TFile[];
  handleRemoveLink: (note: TFile) => void;
}) => {
  return (
    <div class="coi-linked-notes">
      <h4>Linked Notes:</h4>
      <ul>
        {notes.map((note) => (
          <li>
            <NoteLink href="#">{note.basename}</NoteLink>
            <button
              class="coi-remove-link"
              onClick={() => handleRemoveLink(note)}
            >
              &times;
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
