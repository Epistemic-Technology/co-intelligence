import { setIcon } from "obsidian";
import { onMount } from "solid-js";

export const LucideIcon = ({ name }: { name: string }) => {
  let iconRef: HTMLDialogElement | undefined;
  onMount(() => {
    if (iconRef) {
      setIcon(iconRef, name);
    }
  });
  return <span ref={iconRef} class="coi-lucide-icon"></span>;
};
