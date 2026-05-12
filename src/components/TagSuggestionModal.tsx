import { App, SuggestModal } from "obsidian";

/**
 * Modal component for suggesting tags as the user types
 * Extends Obsidian's SuggestModal to show a list of tags matching the user's input
 */
export class TagSuggestionModal extends SuggestModal<string> {
  private onSelect: (tag: string) => void;
  private allTags: string[] = [];

  /**
   * Creates a new TagSuggestionModal
   * @param app The Obsidian App instance
   * @param initialQuery Initial search query to populate the modal
   * @param onSelect Callback function when a tag is selected
   */
  constructor(app: App, initialQuery: string, onSelect: (tag: string) => void) {
    super(app);
    this.onSelect = onSelect;

    // Set modal properties
    this.setPlaceholder("Search for a tag...");

    // Collect all unique tags from the vault
    const tagsObj = this.app.metadataCache.getTags();
    this.allTags = Object.keys(tagsObj).map((tag) => tag.substring(1)); // Remove # prefix

    // Initialize with any provided query
    if (initialQuery) {
      this.inputEl.value = initialQuery.startsWith("#")
        ? initialQuery
        : "#" + initialQuery;
      this.inputEl.trigger("input");
    } else {
      this.inputEl.value = "#";
    }

    // Position the cursor at the end of the input field
    const len = this.inputEl.value.length;
    this.inputEl.setSelectionRange(len, len);

    // Auto-focus the input
    this.inputEl.focus();
  }

  /**
   * Returns filtered suggestions based on the query
   * @param query The search term entered by the user
   * @returns Array of matching tag strings, sorted by relevance and limited to 10 results
   */
  getSuggestions(query: string): string[] {
    // Remove # if present in the query
    const cleanQuery = query.startsWith("#")
      ? query.substring(1).toLowerCase()
      : query.toLowerCase();

    if (!cleanQuery) {
      // If no query, return the most recent or popular tags (limited to 10)
      return this.allTags.slice(0, 10);
    }

    // First try exact matches at the beginning of tag
    const exactMatches = this.allTags.filter((tag) =>
      tag.toLowerCase().startsWith(cleanQuery),
    );

    // Then include partial matches elsewhere in the tag
    const partialMatches = this.allTags.filter(
      (tag) =>
        !tag.toLowerCase().startsWith(cleanQuery) &&
        tag.toLowerCase().includes(cleanQuery),
    );

    // Combine and limit to 10 results
    return [...exactMatches, ...partialMatches].slice(0, 10);
  }

  /**
   * Renders each suggestion item in the modal
   * @param tag The tag to render
   * @param el The HTML element to render into
   */
  renderSuggestion(tag: string, el: HTMLElement) {
    el.createDiv({
      text: `#${tag}`,
      cls: "coi-tag-suggestion-item",
    });
  }

  /**
   * Called when the user selects a suggestion
   * @param tag The selected tag
   * @param _evt The triggering event (mouse or keyboard)
   */
  onChooseSuggestion(tag: string, _evt: MouseEvent | KeyboardEvent) {
    // Ensure the tag has a # prefix when sending it back
    const formattedTag = tag.startsWith("#") ? tag : `#${tag}`;
    this.onSelect(formattedTag);
    this.close();
  }
}
