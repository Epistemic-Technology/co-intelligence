import { App, TFile, SuggestModal } from "obsidian";

/**
 * Modal component for suggesting note links as the user types
 * Extends Obsidian's SuggestModal to show a list of notes matching the user's input
 */
export class NoteLinkSuggestionModal extends SuggestModal<TFile> {
  private onSelect: (file: TFile) => void;
  
  /**
   * Creates a new NoteLinkSuggestionModal
   * @param app The Obsidian App instance
   * @param initialQuery Initial search query to populate the modal
   * @param onSelect Callback function when a note is selected
   */
  constructor(app: App, initialQuery: string, onSelect: (file: TFile) => void) {
    super(app);
    this.onSelect = onSelect;

    // Set modal properties
    this.setPlaceholder("Search for a note...");
    
    // Initialize with any provided query
    if (initialQuery) {
      this.inputEl.value = initialQuery;
      this.inputEl.trigger("input");
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
   * @returns Array of matching TFile objects, sorted by relevance and limited to 10 results
   */
  getSuggestions(query: string): TFile[] {
    const files = this.app.vault.getMarkdownFiles();
    const lowerQuery = query.toLowerCase();
    
    // First try exact matches at the beginning of filename
    const exactMatches = files.filter(file => 
      file.basename.toLowerCase().startsWith(lowerQuery)
    );
    
    // Then include partial matches elsewhere in the filename
    const partialMatches = files.filter(file => 
      !file.basename.toLowerCase().startsWith(lowerQuery) && 
      file.basename.toLowerCase().includes(lowerQuery)
    );
    
    // Combine and limit to 10 results
    return [...exactMatches, ...partialMatches].slice(0, 10);
  }

  /**
   * Renders each suggestion item in the modal
   * @param file The note file to render
   * @param el The HTML element to render into
   */
  renderSuggestion(file: TFile, el: HTMLElement) {
    el.createEl("div", {
      text: file.basename,
      cls: "coi-note-suggestion-item"
    });
  }

  /**
   * Called when the user selects a suggestion
   * @param file The selected note file
   * @param evt The triggering event (mouse or keyboard)
   */
  onChooseSuggestion(file: TFile, evt: MouseEvent | KeyboardEvent) {
    this.onSelect(file);
    this.close();
  }
}