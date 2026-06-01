import { useContext } from "solid-js";

import { AppContext } from "@/CoiChatApp";

/**
 * Returns a click handler that intercepts anchor clicks inside rendered
 * markdown so internal `[[wikilinks]]` open via the workspace, tag links
 * dispatch an Obsidian search, and external URLs open in a new tab. Extracted
 * from the original ChatMessage so it can wrap parts-based bot/user messages.
 */
export function useLinkClicks(): (event: MouseEvent) => void {
    const app = useContext(AppContext);
    return (event) => {
        const target = event.target as HTMLElement | null;
        if (!target || target.tagName !== "A") return;
        event.preventDefault();
        const anchor = target as HTMLAnchorElement;
        const href = anchor.getAttribute("href");
        if (!href || !app) return;
        if (href.startsWith("#")) {
            window.open(
                `obsidian://search?query=${encodeURIComponent("#" + href.slice(1))}`,
            );
            return;
        }
        if (anchor.classList.contains("internal-link")) {
            const newLeaf = event.ctrlKey || event.metaKey;
            void app.workspace.openLinkText(href, "", newLeaf);
            return;
        }
        window.open(href, "_blank");
    };
}
