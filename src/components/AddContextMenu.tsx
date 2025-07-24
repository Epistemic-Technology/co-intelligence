import { Component, onMount, createSignal, Show } from "solid-js";
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
  let menuRef: HTMLDivElement | undefined;
  let noteIconRef: HTMLSpanElement | undefined;
  let tagIconRef: HTMLSpanElement | undefined;
  let noteButtonRef: HTMLButtonElement | undefined;
  let tagButtonRef: HTMLButtonElement | undefined;

  const [focusedIndex, setFocusedIndex] = createSignal(0);
  const [isOpen, setIsOpen] = createSignal(false);
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
    setIsOpen(true);
    setFocusedIndex(0);

    // Focus the first menu item
    window.setTimeout(() => {
      noteButtonRef?.focus();
    }, 0);
  };

  const closeMenu = () => {
    setIsOpen(false);
  };

  const handleBackdropClick = () => {
    closeMenu();
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
      <Show when={isOpen()}>
        <div ref={menuRef!} class="coi-add-context-menu-content" role="menu">
          <h3>Add context</h3>
          <ul class="coi-add-context-menu-options">
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
      </Show>
      <Show when={isOpen()}>
        <div
          class="coi-add-context-menu-backdrop"
          onClick={handleBackdropClick}
          onKeyDown={handleKeyDown}
        />
      </Show>
    </div>
  );
};
