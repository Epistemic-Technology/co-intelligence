/**
 * Mock implementation of the Obsidian API for testing.
 */
import { vi } from "vitest";

// --- Core file types ---
// Note: vault property is typed as any to avoid circular instantiation
// (TAbstractFile -> Vault -> TFile -> TAbstractFile -> ...).

export class TAbstractFile {
  path = "";
  name = "";
  parent: TFolder | null = null;
  vault: any = null;
}

export class TFile extends TAbstractFile {
  basename = "";
  extension = "md";
  stat = { ctime: 0, mtime: 0, size: 0 };
}

export class TFolder extends TAbstractFile {
  children: TAbstractFile[] = [];
  isRoot(): boolean {
    return this.parent === null;
  }
}

// --- Vault ---

export class Vault {
  read = vi.fn().mockResolvedValue("");
  cachedRead = vi.fn().mockResolvedValue("");
  create = vi.fn().mockImplementation(async () => new TFile());
  modify = vi.fn().mockResolvedValue(undefined);
  delete = vi.fn().mockResolvedValue(undefined);
  rename = vi.fn().mockResolvedValue(undefined);
  getAbstractFileByPath = vi.fn().mockReturnValue(null);
  getMarkdownFiles = vi.fn().mockReturnValue([]);
  createFolder = vi.fn().mockImplementation(async () => new TFolder());
}

// --- Workspace ---

export class WorkspaceLeaf {
  view: Record<string, unknown> = {};
  openFile = vi.fn().mockResolvedValue(undefined);
  setViewState = vi.fn().mockResolvedValue(undefined);
}

export class Workspace {
  getLeaf = vi.fn().mockReturnValue(new WorkspaceLeaf());
  getActiveViewOfType = vi.fn().mockReturnValue(null);
  on = vi.fn().mockReturnValue({ id: "mock-event-ref" });
  off = vi.fn();
  getLeavesOfType = vi.fn().mockReturnValue([]);
}

// --- MetadataCache ---

export class MetadataCache {
  getFileCache = vi.fn().mockReturnValue(null);
  getCache = vi.fn().mockReturnValue(null);
  on = vi.fn().mockReturnValue({ id: "mock-event-ref" });
}

// --- FileManager ---

export class FileManager {
  processFrontMatter = vi.fn().mockImplementation(
    async (_file: TFile, fn: (frontmatter: Record<string, unknown>) => void) => {
      const frontmatter: Record<string, unknown> = {};
      fn(frontmatter);
    },
  );
  renameFile = vi.fn().mockResolvedValue(undefined);
}

// --- App ---

export class App {
  vault = new Vault();
  workspace = new Workspace();
  metadataCache = new MetadataCache();
  fileManager = new FileManager();
}

// --- View classes ---

export class TextFileView {
  app: App;
  leaf: WorkspaceLeaf;
  file: TFile | null = null;
  data = "";
  requestSave = vi.fn();

  constructor(leaf: WorkspaceLeaf) {
    this.leaf = leaf;
    this.app = new App();
  }

  getViewData(): string {
    return this.data;
  }

  setViewData(_data: string, _clear: boolean): void {}

  clear(): void {}
}

// --- UI classes ---

export class Notice {
  constructor(_message: string, _timeout?: number) {}
}

export class Setting {
  settingEl = document.createElement("div");
  controlEl = document.createElement("div");
  nameEl = document.createElement("div");
  descEl = document.createElement("div");

  constructor(_containerEl: HTMLElement) {}

  setName(_name: string): this {
    return this;
  }

  setDesc(_desc: string): this {
    return this;
  }

  addText(cb: (component: TextComponent) => void): this {
    cb(new TextComponent(document.createElement("input")));
    return this;
  }

  addDropdown(cb: (component: DropdownComponent) => void): this {
    cb(new DropdownComponent(document.createElement("select")));
    return this;
  }

  addToggle(cb: (component: ToggleComponent) => void): this {
    cb(new ToggleComponent(document.createElement("div")));
    return this;
  }

  addButton(cb: (component: ButtonComponent) => void): this {
    cb(new ButtonComponent(document.createElement("button")));
    return this;
  }
}

class TextComponent {
  inputEl: HTMLInputElement;
  constructor(inputEl: HTMLElement) {
    this.inputEl = inputEl as HTMLInputElement;
  }
  setPlaceholder(_ph: string): this {
    return this;
  }
  setValue(_val: string): this {
    return this;
  }
  onChange(_cb: (value: string) => void): this {
    return this;
  }
}

class DropdownComponent {
  selectEl: HTMLSelectElement;
  constructor(selectEl: HTMLElement) {
    this.selectEl = selectEl as HTMLSelectElement;
  }
  addOption(_value: string, _display: string): this {
    return this;
  }
  setValue(_val: string): this {
    return this;
  }
  onChange(_cb: (value: string) => void): this {
    return this;
  }
}

class ToggleComponent {
  toggleEl: HTMLElement;
  constructor(el: HTMLElement) {
    this.toggleEl = el;
  }
  setValue(_val: boolean): this {
    return this;
  }
  onChange(_cb: (value: boolean) => void): this {
    return this;
  }
}

class ButtonComponent {
  buttonEl: HTMLButtonElement;
  constructor(el: HTMLElement) {
    this.buttonEl = el as HTMLButtonElement;
  }
  setButtonText(_text: string): this {
    return this;
  }
  setCta(): this {
    return this;
  }
  onClick(_cb: () => void): this {
    return this;
  }
}

export class SuggestModal<T> {
  app: App;
  inputEl = document.createElement("input");
  resultContainerEl = document.createElement("div");

  constructor(app: App) {
    this.app = app;
  }

  open(): void {}
  close(): void {}

  getSuggestions(_query: string): T[] {
    return [];
  }

  renderSuggestion(_item: T, _el: HTMLElement): void {}

  onChooseSuggestion(_item: T, _evt: MouseEvent | KeyboardEvent): void {}
}

// --- Plugin classes ---

export class Plugin {
  app: App;
  manifest: PluginManifest;

  constructor(app: App, manifest: PluginManifest) {
    this.app = app;
    this.manifest = manifest;
  }

  addCommand = vi.fn();
  addRibbonIcon = vi.fn();
  addSettingTab = vi.fn();
  registerView = vi.fn();
  registerEvent = vi.fn();
  registerExtensions = vi.fn();
  loadData = vi.fn().mockResolvedValue(null);
  saveData = vi.fn().mockResolvedValue(undefined);
}

export class PluginSettingTab {
  app: App;
  plugin: Plugin;
  containerEl = document.createElement("div");

  constructor(app: App, plugin: Plugin) {
    this.app = app;
    this.plugin = plugin;
  }

  display(): void {}
  hide(): void {}
}

// --- Interfaces / types ---

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
}

export interface ViewState {
  type: string;
  state?: Record<string, unknown>;
  active?: boolean;
}

export interface CachedMetadata {
  frontmatter?: Record<string, unknown>;
  tags?: { tag: string; position: unknown }[];
}

export interface Menu {
  addItem: (cb: (item: MenuItem) => void) => Menu;
  showAtMouseEvent: (evt: MouseEvent) => void;
}

export interface MenuItem {
  setTitle: (title: string) => MenuItem;
  setIcon: (icon: string) => MenuItem;
  onClick: (cb: () => void) => MenuItem;
}

export interface Command {
  id: string;
  name: string;
  callback?: () => void;
  checkCallback?: (checking: boolean) => boolean;
}

// --- Utility functions ---

export function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+/g, "/");
}

export function getAllTags(cache: CachedMetadata): string[] | null {
  if (!cache.tags) return null;
  return cache.tags.map((t) => t.tag);
}

export const requestUrl = vi.fn().mockResolvedValue({ text: "", json: {} });

export function htmlToMarkdown(html: string): string {
  return html;
}

export function setIcon(_el: HTMLElement, _iconId: string): void {}

export function getIcon(_iconId: string): SVGSVGElement | null {
  return null;
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  _delay: number,
): T {
  return fn;
}

export class MarkdownRenderer {
  static render = vi.fn().mockResolvedValue(undefined);
}

export class MarkdownRenderChild {
  containerEl: HTMLElement;
  constructor(containerEl: HTMLElement) {
    this.containerEl = containerEl;
  }
  onload(): void {}
  onunload(): void {}
}
