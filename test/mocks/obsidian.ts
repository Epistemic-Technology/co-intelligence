import { vi } from 'vitest';

// Minimal Obsidian API mocks - only implement what we actually use

export class TFile {
  path: string;
  basename: string;
  extension: string;
  name: string;
  parent: TFolder | null = null;
  
  constructor(path: string) {
    this.path = path;
    this.name = path.split('/').pop() || '';
    this.basename = this.name.replace(/\.[^/.]+$/, '');
    this.extension = path.split('.').pop() || '';
    
    // Set parent if path has directories
    const parentPath = path.split('/').slice(0, -1).join('/');
    if (parentPath) {
      this.parent = new TFolder(parentPath);
    }
  }
}

export class TFolder {
  path: string;
  name: string;
  
  constructor(path: string) {
    this.path = path;
    this.name = path.split('/').pop() || '';
  }
}

export class Plugin {
  app: App;
  manifest: any;
  
  constructor(app: App, manifest: any) {
    this.app = app;
    this.manifest = manifest;
  }
  
  addCommand = vi.fn().mockReturnValue(this);
  addSettingTab = vi.fn().mockReturnValue(this);
  registerView = vi.fn().mockReturnValue(this);
  saveData = vi.fn().mockResolvedValue(undefined);
  loadData = vi.fn().mockResolvedValue({});
  onload = vi.fn();
  onunload = vi.fn();
}

export class App {
  vault = {
    create: vi.fn().mockResolvedValue(new TFile('test.md')),
    modify: vi.fn().mockResolvedValue(undefined),
    read: vi.fn().mockResolvedValue(''),
    cachedRead: vi.fn().mockResolvedValue(''),
    getMarkdownFiles: vi.fn().mockReturnValue([]),
    delete: vi.fn().mockResolvedValue(undefined),
    exists: vi.fn().mockReturnValue(true),
    getAbstractFileByPath: vi.fn(),
    createFolder: vi.fn().mockResolvedValue(new TFolder('test')),
  };
  
  workspace = {
    getLeaf: vi.fn().mockReturnValue({
      view: null,
      setViewState: vi.fn().mockResolvedValue(undefined),
      openFile: vi.fn().mockResolvedValue(undefined),
    }),
    activeLeaf: null,
    on: vi.fn(),
    off: vi.fn(),
    trigger: vi.fn(),
    getLeavesOfType: vi.fn().mockReturnValue([]),
    detachLeavesOfType: vi.fn(),
  };
  
  metadataCache = {
    getFileCache: vi.fn().mockReturnValue(null),
    getCache: vi.fn().mockReturnValue(null),
    on: vi.fn(),
    off: vi.fn(),
  };
  
  fileManager = {
    processFrontMatter: vi.fn(),
    generateMarkdownLink: vi.fn(),
    renameFile: vi.fn().mockResolvedValue(undefined),
  };
}

export class WorkspaceLeaf {
  view: any = null;
  
  setViewState = vi.fn().mockResolvedValue(undefined);
  detach = vi.fn();
  getViewState = vi.fn().mockReturnValue({});
}

export class ItemView {
  app: App;
  leaf: WorkspaceLeaf;
  
  constructor(leaf: WorkspaceLeaf) {
    this.leaf = leaf;
    this.app = leaf.view?.app || new App();
  }
  
  onOpen = vi.fn().mockResolvedValue(undefined);
  onClose = vi.fn().mockResolvedValue(undefined);
  getDisplayText = vi.fn().mockReturnValue('Test View');
  getViewType = vi.fn().mockReturnValue('test-view');
}

export class TextFileView extends ItemView {
  file: TFile | null = null;
  
  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }
  
  onLoadFile = vi.fn().mockResolvedValue(undefined);
  onUnloadFile = vi.fn().mockResolvedValue(undefined);
  getViewData = vi.fn().mockReturnValue('');
  setViewData = vi.fn();
  clear = vi.fn();
}

export class PluginSettingTab {
  app: App;
  plugin: Plugin;
  
  constructor(app: App, plugin: Plugin) {
    this.app = app;
    this.plugin = plugin;
  }
  
  display = vi.fn();
  hide = vi.fn();
}

export class Setting {
  constructor(containerEl: HTMLElement) {}
  
  setName = vi.fn().mockReturnThis();
  setDesc = vi.fn().mockReturnThis();
  addText = vi.fn().mockReturnThis();
  addToggle = vi.fn().mockReturnThis();
  addDropdown = vi.fn().mockReturnThis();
}

export class SuggestModal<T> {
  app: App;
  
  constructor(app: App) {
    this.app = app;
  }
  
  open = vi.fn();
  close = vi.fn();
  getSuggestions = vi.fn().mockReturnValue([]);
  renderSuggestion = vi.fn();
  onChooseSuggestion = vi.fn();
}

export class Modal {
  app: App;
  
  constructor(app: App) {
    this.app = app;
  }
  
  open = vi.fn();
  close = vi.fn();
  onOpen = vi.fn();
  onClose = vi.fn();
}

// Mock global functions
export const addIcon = vi.fn();
export const debounce = vi.fn((fn: Function, delay: number) => fn);
export const normalizePath = vi.fn((path: string) => path);
export const parseFrontMatterEntry = vi.fn();
export const parseFrontMatterStringArray = vi.fn();
export const parseFrontMatterTags = vi.fn();

// Default export for compatibility
export default {
  TFile,
  TFolder,
  Plugin,
  App,
  WorkspaceLeaf,
  ItemView,
  TextFileView,
  PluginSettingTab,
  Setting,
  SuggestModal,
  Modal,
  addIcon,
  debounce,
  normalizePath,
  parseFrontMatterEntry,
  parseFrontMatterStringArray,
  parseFrontMatterTags,
};