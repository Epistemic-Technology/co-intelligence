import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CoIntelligencePlugin } from "../CoIntelligencePlugin";
import { CoIntelligenceSettingsTab, DEFAULT_SETTINGS } from "../settings";
import { ModelRegistry } from "@/services/model-registry";
import { VIEW_TYPE_COI_CHAT } from "@/ChatView";
import type { App, PluginManifest, WorkspaceLeaf, TFile, Menu, ViewState } from "obsidian";

vi.mock("obsidian", () => ({
  Plugin: class Plugin {
    app: any;
    manifest: any;
    constructor(app: any, manifest: any) {
      this.app = app;
      this.manifest = manifest;
    }
    addSettingTab = vi.fn();
    addCommand = vi.fn();
    registerView = vi.fn();
    addRibbonIcon = vi.fn();
    registerEvent = vi.fn();
    register = vi.fn();
    loadData = vi.fn();
    saveData = vi.fn();
  },
  TFile: class TFile {
    path: string;
    basename: string;
    constructor(path: string, basename: string) {
      this.path = path;
      this.basename = basename;
    }
  },
  around: vi.fn((target, patches) => {
    return () => {};
  }),
}));

vi.mock("../settings", () => ({
  CoIntelligenceSettingsTab: vi.fn(),
  DEFAULT_SETTINGS: {
    openaiApiKey: "",
    anthropicApiKey: "",
    googleApiKey: "",
    perplexityApiKey: "",
    defaultFolder: "coi",
    defaultModel: "",
    renamingModel: "",
    systemPromptFolder: "coi/prompts",
    defaultSystemPromptNote: "",
  },
}));

vi.mock("@/services/model-registry", () => ({
  ModelRegistry: {
    getInstance: vi.fn(),
  },
}));

vi.mock("@/commands/new-chat", () => ({
  NewChatCommand: vi.fn(),
}));

vi.mock("@/commands/toggle-chat-view", () => ({
  ToggleChatViewCommand: vi.fn(),
}));

vi.mock("@/ChatView", () => ({
  ChatView: vi.fn(),
  VIEW_TYPE_COI_CHAT: "co-intelligence-chat",
}));

vi.mock("@/utils/notes", () => ({
  isCoiNote: vi.fn(),
  isPathActiveCoiNote: vi.fn(),
  isActiveCoiNote: vi.fn(),
  createCOINote: vi.fn(),
  waitForMetadataCache: vi.fn(),
}));

describe("CoIntelligencePlugin", () => {
  let app: App;
  let manifest: PluginManifest;
  let plugin: CoIntelligencePlugin;
  let mockRegistry: ModelRegistry;

  beforeEach(() => {
    vi.clearAllMocks();

    app = {
      workspace: {
        on: vi.fn(),
        onLayoutReady: vi.fn((callback) => callback()),
        getActiveFile: vi.fn(),
      },
      vault: {
        on: vi.fn(),
      },
      fileManager: {
        processFrontMatter: vi.fn(),
      },
      commands: {
        executeCommandById: vi.fn(),
      },
    } as any;

    manifest = {
      id: "co-intelligence",
      name: "Co-Intelligence",
      version: "1.0.0",
    } as PluginManifest;

    mockRegistry = {} as ModelRegistry;
    vi.mocked(ModelRegistry.getInstance).mockReturnValue(mockRegistry);

    plugin = new CoIntelligencePlugin(app, manifest);
  });

  describe("constructor", () => {
    it("should initialize with default settings", () => {
      expect(plugin.settings).toEqual(DEFAULT_SETTINGS);
      expect(plugin.isPerformingAutomaticRename).toBe(false);
    });
  });

  describe("onload", () => {
    it("should initialize plugin components", async () => {
      plugin.loadData = vi.fn().mockResolvedValue({});
      await plugin.onload();

      expect(plugin.registry).toBe(mockRegistry);
      expect(plugin.addSettingTab).toHaveBeenCalled();
      expect(plugin.addCommand).toHaveBeenCalledTimes(2);
      expect(plugin.registerView).toHaveBeenCalledWith(
        VIEW_TYPE_COI_CHAT,
        expect.any(Function)
      );
      expect(plugin.addRibbonIcon).toHaveBeenCalledWith(
        "bot-message-square",
        "New COI chat",
        expect.any(Function)
      );
    });

    it("should register event handlers", async () => {
      await plugin.onload();

      expect(plugin.registerEvent).toHaveBeenCalledWith(
        app.workspace.on("file-open", expect.any(Function))
      );
      expect(plugin.registerEvent).toHaveBeenCalledWith(
        app.vault.on("rename", expect.any(Function))
      );
      expect(plugin.registerEvent).toHaveBeenCalledWith(
        app.workspace.on("file-menu", expect.any(Function))
      );
    });

    it("should call onLayoutReady", async () => {
      await plugin.onload();

      expect(app.workspace.onLayoutReady).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe("loadSettings", () => {
    it("should merge loaded data with default settings", async () => {
      const customSettings = {
        openaiApiKey: "test-key",
        defaultFolder: "custom-folder",
      };
      plugin.loadData = vi.fn().mockResolvedValue(customSettings);

      await plugin.loadSettings();

      expect(plugin.settings).toEqual({
        ...DEFAULT_SETTINGS,
        ...customSettings,
      });
    });

    it("should use default settings when no data is loaded", async () => {
      plugin.loadData = vi.fn().mockResolvedValue(null);

      await plugin.loadSettings();

      expect(plugin.settings).toEqual(DEFAULT_SETTINGS);
    });
  });

  describe("saveSettings", () => {
    it("should save current settings", async () => {
      plugin.saveData = vi.fn();
      plugin.settings = { ...DEFAULT_SETTINGS, openaiApiKey: "test-key" };

      await plugin.saveSettings();

      expect(plugin.saveData).toHaveBeenCalledWith(plugin.settings);
    });
  });

  describe("handleFileRename", () => {
    let mockFile: TFile;

    beforeEach(async () => {
      const { TFile } = await import("obsidian");
      mockFile = new TFile("test.md", "test");
    });

    it("should mark COI notes as renamed when not automatic", async () => {
      const { isCoiNote, waitForMetadataCache } = await import("@/utils/notes");
      vi.mocked(isCoiNote).mockReturnValue(true);

      plugin.isPerformingAutomaticRename = false;
      const processFrontMatterCallback = vi.fn();
      
      app.fileManager.processFrontMatter = vi.fn(async (file, callback) => {
        const frontmatter = {};
        callback(frontmatter);
        processFrontMatterCallback(frontmatter);
      });

      await plugin["handleFileRename"](mockFile, "old-path.md");

      expect(waitForMetadataCache).toHaveBeenCalledWith(app, mockFile);
      expect(processFrontMatterCallback).toHaveBeenCalledWith(
        expect.objectContaining({ "note-renamed": true })
      );
    });

    it("should not mark as renamed when automatic rename", async () => {
      const { isCoiNote, waitForMetadataCache } = await import("@/utils/notes");
      vi.mocked(isCoiNote).mockReturnValue(true);

      plugin.isPerformingAutomaticRename = true;

      await plugin["handleFileRename"](mockFile, "old-path.md");

      expect(waitForMetadataCache).toHaveBeenCalledWith(app, mockFile);
      expect(app.fileManager.processFrontMatter).not.toHaveBeenCalled();
      expect(plugin.isPerformingAutomaticRename).toBe(false);
    });

    it("should ignore non-TFile objects", async () => {
      const notAFile = { path: "not-a-file" } as any;

      await plugin["handleFileRename"](notAFile, "old-path");

      expect(app.fileManager.processFrontMatter).not.toHaveBeenCalled();
    });

    it("should ignore non-COI notes", async () => {
      const { isCoiNote } = await import("@/utils/notes");
      vi.mocked(isCoiNote).mockReturnValue(false);

      await plugin["handleFileRename"](mockFile, "old-path.md");

      expect(app.fileManager.processFrontMatter).not.toHaveBeenCalled();
    });
  });

  describe("onFileMenuHandler", () => {
    let mockMenu: Menu;
    let mockFile: TFile;
    let mockLeaf: WorkspaceLeaf;

    beforeEach(async () => {
      mockMenu = {
        addItem: vi.fn(),
      } as any;

      const { TFile } = await import("obsidian");
      mockFile = new TFile("test.md", "test");

      mockLeaf = {} as WorkspaceLeaf;
    });


    it("should not add menu item for non-COI notes", async () => {
      const { isCoiNote } = await import("@/utils/notes");
      vi.mocked(isCoiNote).mockReturnValue(false);

      await plugin["onFileMenuHandler"](mockMenu, mockFile, "file-explorer", mockLeaf);

      expect(mockMenu.addItem).not.toHaveBeenCalled();
    });

    it("should not add menu item for active COI notes", async () => {
      const { isCoiNote, isActiveCoiNote } = await import("@/utils/notes");
      vi.mocked(isCoiNote).mockReturnValue(true);
      vi.mocked(isActiveCoiNote).mockReturnValue(true);

      await plugin["onFileMenuHandler"](mockMenu, mockFile, "file-explorer", mockLeaf);

      expect(mockMenu.addItem).not.toHaveBeenCalled();
    });
  });


  describe("ribbon icon", () => {
    it("should create COI note when ribbon icon is clicked", async () => {
      const { createCOINote } = await import("@/utils/notes");
      let ribbonClickHandler: () => void;

      plugin.addRibbonIcon = vi.fn((icon, title, callback) => {
        ribbonClickHandler = callback;
      });

      await plugin.onload();

      ribbonClickHandler!();

      expect(createCOINote).toHaveBeenCalledWith(app, plugin);
    });
  });
});