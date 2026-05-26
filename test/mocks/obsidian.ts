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

// --- DataAdapter (in-memory) ---

export class DataAdapter {
  private files = new Map<string, string>();
  private dirs = new Set<string>([""]);

  getName(): string {
    return "mock";
  }

  exists = vi.fn(async (path: string): Promise<boolean> => {
    return this.files.has(path) || this.dirs.has(path);
  });

  read = vi.fn(async (path: string): Promise<string> => {
    const v = this.files.get(path);
    if (v === undefined) throw new Error(`No such file: ${path}`);
    return v;
  });

  write = vi.fn(async (path: string, data: string): Promise<void> => {
    this.files.set(path, data);
  });

  mkdir = vi.fn(async (path: string): Promise<void> => {
    this.dirs.add(path);
  });

  remove = vi.fn(async (path: string): Promise<void> => {
    this.files.delete(path);
  });

  list = vi.fn(async (_path: string) => ({ files: [], folders: [] }));
}

// --- Vault ---

export class Vault {
  adapter: DataAdapter = new DataAdapter();
  configDir = ".obsidian";
  read = vi.fn().mockResolvedValue("");
  cachedRead = vi.fn().mockResolvedValue("");
  create = vi.fn().mockImplementation(async () => new TFile());
  modify = vi.fn().mockResolvedValue(undefined);
  process = vi
    .fn()
    .mockImplementation(
      async (_file: TFile, fn: (data: string) => string): Promise<string> =>
        fn(""),
    );
  delete = vi.fn().mockResolvedValue(undefined);
  rename = vi.fn().mockResolvedValue(undefined);
  getAbstractFileByPath = vi.fn().mockReturnValue(null);
  getMarkdownFiles = vi.fn().mockReturnValue([]);
  getAllLoadedFiles = vi.fn().mockReturnValue([]);
  createFolder = vi.fn().mockImplementation(async () => new TFolder());
  getRoot = vi.fn().mockImplementation(() => new TFolder());
  getFolderByPath = vi.fn().mockReturnValue(null);
  getFiles = vi.fn().mockReturnValue([]);
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
  getActiveFile = vi.fn().mockReturnValue(null);
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

// --- SecretStorage ---

export class SecretStorage {
  private secrets = new Map<string, string>();

  setSecret = vi.fn((id: string, secret: string): void => {
    this.secrets.set(id, secret);
  });

  getSecret = vi.fn((id: string): string | null => {
    return this.secrets.get(id) ?? null;
  });

  listSecrets = vi.fn((): string[] => Array.from(this.secrets.keys()));
}

// --- App ---

export class App {
  vault = new Vault();
  workspace = new Workspace();
  metadataCache = new MetadataCache();
  fileManager = new FileManager();
  secretStorage = new SecretStorage();
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

export class AbstractInputSuggest<T> {
  app: App;
  protected textInputEl: HTMLInputElement | HTMLDivElement;

  constructor(app: App, textInputEl: HTMLInputElement | HTMLDivElement) {
    this.app = app;
    this.textInputEl = textInputEl;
  }

  protected getSuggestions(_query: string): T[] | Promise<T[]> {
    return [];
  }

  renderSuggestion(_value: T, _el: HTMLElement): void {}

  selectSuggestion(_value: T, _evt: MouseEvent | KeyboardEvent): void {}

  setValue(_value: string): void {}

  close(): void {}
}

export class Modal {
  app: App;
  containerEl = document.createElement("div");
  modalEl = document.createElement("div");
  titleEl = document.createElement("div");
  contentEl = document.createElement("div");
  shouldRestoreSelection = false;

  constructor(app: App) {
    this.app = app;
  }

  open(): void {}
  close(): void {
    this.onClose();
  }
  onOpen(): void | Promise<void> {}
  onClose(): void {}

  setTitle(_title: string): this {
    return this;
  }
  setContent(_content: string | DocumentFragment): this {
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

export const Platform = {
  isDesktop: true,
  isMobile: false,
  isDesktopApp: true,
  isMobileApp: false,
  isIosApp: false,
  isAndroidApp: false,
  isPhone: false,
  isTablet: false,
  isMacOS: false,
  isWin: false,
  isLinux: true,
  isSafari: false,
  resourcePathPrefix: "app://obsidian.md/",
};

export const requestUrl = vi.fn().mockResolvedValue({ text: "", json: {} });

export function htmlToMarkdown(html: string): string {
  return html;
}

export function stringifyYaml(obj: Record<string, unknown>): string {
  return Object.entries(obj)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join("\n") + "\n";
}

export function parseYaml(text: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^([^:]+):\s*(.*)$/);
    if (!m) continue;
    try {
      out[m[1].trim()] = JSON.parse(m[2]);
    } catch {
      out[m[1].trim()] = m[2];
    }
  }
  return out;
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
  load(): void {}
  unload(): void {}
  onload(): void {}
  onunload(): void {}
}
