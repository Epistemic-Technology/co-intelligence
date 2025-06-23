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
    setTimeout(() => {
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

  const closeMenu = () => {
    dialogRef?.close();
  };

  const handleDialogClick = (e: MouseEvent) => {
    if (e.target === dialogRef) {
      closeMenu();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    const items = menuItems().filter(Boolean);
    const currentIndex = focusedIndex();

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        const nextIndex = (currentIndex + 1) % items.length;
        setFocusedIndex(nextIndex);
        items[nextIndex]?.focus();
        break;
      case "ArrowUp":
        e.preventDefault();
        const prevIndex = (currentIndex - 1 + items.length) % items.length;
        setFocusedIndex(prevIndex);
        items[prevIndex]?.focus();
        break;
      case "Escape":
        e.preventDefault();
        closeMenu();
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        items[currentIndex]?.click();
        break;
    }
  };

  const handleNoteClick = () => {
    closeMenu();
    const modal = new NoteLinkSuggestionModal(app, "", (file: TFile) => {
      onAddNote(file);
    });
    modal.open();
  };

  const handleTagClick = () => {
    closeMenu();
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

      <dialog
        ref={dialogRef!}
        class="coi-add-context-menu"
        onClose={closeMenu}
        onClick={handleDialogClick}
        onKeyDown={handleKeyDown}
      >
        <div class="coi-add-context-menu-content">
          <h3>Add context</h3>
          <ul role="menu" class="coi-add-context-menu-options">
            <li>
              <button
                ref={noteButtonRef!}
                type="button"
                role="menuitem"
                class="coi-add-context-menu-option"
                onClick={handleNoteClick}
              >
                <span
                  ref={noteIconRef!}
                  class="coi-add-context-menu-icon"
                ></span>
                Add note
              </button>
            </li>
            <li>
              <button
                ref={tagButtonRef!}
                type="button"
                role="menuitem"
                class="coi-add-context-menu-option"
                onClick={handleTagClick}
              >
                <span
                  ref={tagIconRef!}
                  class="coi-add-context-menu-icon"
                ></span>
                Add tag
              </button>
            </li>
          </ul>
        </div>
      </dialog>
    </div>
  );
};
