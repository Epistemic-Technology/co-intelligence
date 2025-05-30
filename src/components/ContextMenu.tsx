import { createSignal, onMount, onCleanup } from "solid-js";

export interface ContextMenuProps {
  onClose: () => void;
  onSelectNote: () => void;
  onSelectTag: () => void;
  buttonElement: HTMLElement | null;
}

export const ContextMenu = (props: ContextMenuProps) => {
  let menuRef: HTMLDivElement | undefined;
  const [position, setPosition] = createSignal({ top: 0, left: 0 });

  const calculatePosition = () => {
    if (!props.buttonElement || !menuRef) return;

    const buttonRect = props.buttonElement.getBoundingClientRect();
    const menuRect = menuRef.getBoundingClientRect();

    // Position above the button
    let top = buttonRect.top - menuRect.height - 8;
    let left = buttonRect.left;

    // Adjust if menu would go off screen
    if (top < 0) {
      top = buttonRect.bottom + 8;
    }

    if (left + menuRect.width > window.innerWidth) {
      left = window.innerWidth - menuRect.width - 8;
    }

    if (left < 8) {
      left = 8;
    }

    setPosition({ top, left });
  };

  const handleClickOutside = (event: MouseEvent) => {
    if (
      menuRef &&
      !menuRef.contains(event.target as Node) &&
      props.buttonElement &&
      !props.buttonElement.contains(event.target as Node)
    ) {
      props.onClose();
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      props.onClose();
    }
  };

  onMount(() => {
    // Add a small delay to prevent the opening click from immediately closing the menu
    setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
    }, 0);
    document.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => {
    document.removeEventListener("click", handleClickOutside);
    document.removeEventListener("keydown", handleKeyDown);
  });

  const handleNoteClick = () => {
    props.onSelectNote();
    props.onClose();
  };

  const handleTagClick = () => {
    props.onSelectTag();
    props.onClose();
  };

  return (
    <div
      ref={(el) => {
        menuRef = el;
        requestAnimationFrame(() => {
          calculatePosition();
        });
      }}
      class="coi-context-menu"
      style={{
        position: "fixed",
        top: `${position().top}px`,
        left: `${position().left}px`,
        "z-index": "1000",
      }}
    >
      <button
        class="coi-context-menu-item"
        onClick={handleNoteClick}
        type="button"
      >
        📝 Note
      </button>
      <button
        class="coi-context-menu-item"
        onClick={handleTagClick}
        type="button"
      >
        🏷️ Tag
      </button>
    </div>
  );
};
