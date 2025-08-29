import { Component, onMount, createSignal } from "solid-js";
import { App, TFile, setIcon } from "obsidian";
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
  let dialogRef: HTMLDialogElement | undefined;
  let noteIconRef: HTMLSpanElement | undefined;
  let tagIconRef: HTMLSpanElement | undefined;
  let noteButtonRef: HTMLButtonElement | undefined;
  let tagButtonRef: HTMLButtonElement | undefined;

  const [focusedIndex, setFocusedIndex] = createSignal(0);
  const menuItems = () => [noteButtonRef, tagButtonRef];

  onMount(() => {
    if (noteIconRef) {
      setIcon(noteIconRef, "file-text");
    }
    if (tagIconRef) {
      setIcon(tagIconRef, "tag");
    }
  });

  const openMenu = () => {
    if (!dialogRef) return;

    dialogRef.showModal();
    setFocusedIndex(0);

    // Focus the first menu item
    window.setTimeout(() => {
      noteButtonRef?.focus();
    }, 0);

    const buttonRect =
      dialogRef.previousElementSibling?.getBoundingClientRect();
    if (buttonRect) {
      const dialogContent = dialogRef.querySelector(
        ".coi-add-context-menu-content",
      ) as HTMLElement;
      if (dialogContent) {
        dialogContent.style.position = "fixed";
        dialogContent.style.top = `${buttonRect.top - dialogContent.offsetHeight - 4}px`;
        dialogContent.style.left = `${buttonRect.right - dialogContent.offsetWidth}px`;
      }
    }
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

  return (
    <div class="coi-add-context-wrapper">
      <button
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
