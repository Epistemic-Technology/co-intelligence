import { Component, onMount, createSignal } from "solid-js";
import { App, TFile, Menu, setIcon } from "obsidian";
import { NoteLinkSuggestionModal } from "@/components/NoteLinkSuggestionModal";
import { TagSuggestionModal } from "@/components/TagSuggestionModal";
import { Tag } from "@/types";

export interface AddContextMenuProps {
  app: App;
  onAddNote: (file: TFile) => void;
  onAddTag: (tag: Tag) => void;
}

export const AddContextMenu: Component<AddContextMenuProps> = ({
  app,
  onAddNote,
  onAddTag,
}) => {
  let noteButtonRef: HTMLButtonElement | undefined;

  const openMenu = () => {
    const buttonRect = noteButtonRef?.getBoundingClientRect();
    let left = 0;
    let bottom = 0;
    if (buttonRect) {
      left = buttonRect.left;
      bottom = buttonRect.bottom;
    }
    menu.showAtPosition({ x: left, y: bottom });
  };

  const handleNoteClick = () => {
    const modal = new NoteLinkSuggestionModal(app, "", (file: TFile) => {
      onAddNote(file);
    });
    modal.open();
  };

  const handleTagClick = () => {
    const modal = new TagSuggestionModal(app, "", (tag: Tag) => {
      onAddTag(tag);
    });
    modal.open();
  };

  const menu = new Menu();
  menu.addItem((item) =>
    item.setTitle("Add note").setIcon("file-text").onClick(handleNoteClick),
  );
  menu.addItem((item) =>
    item.setTitle("Add tag").setIcon("tag").onClick(handleTagClick),
  );

  return (
    <div class="coi-add-context-wrapper">
      <button
        ref={noteButtonRef}
        aria-label="Add context"
        title="Add context to note"
        type="button"
        class="coi-user-input-add-context-button"
        onClick={openMenu}
      >
        +
      </button>
    </div>
  );
};
