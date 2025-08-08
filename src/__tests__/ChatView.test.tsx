import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ChatView, VIEW_TYPE_COI_CHAT } from "../ChatView";
import type { WorkspaceLeaf, App, TFile } from "obsidian";
import type CoIntelligencePlugin from "@/CoIntelligencePlugin";
import type { ModelChatMessage, ContextItems } from "@/types";

vi.mock("obsidian", () => ({
  TextFileView: class TextFileView {
    leaf: any;
    app: any;
    constructor(leaf: any) {
      this.leaf = leaf;
    }
    registerEvent = vi.fn();
    requestSave = vi.fn();
  },
  Notice: vi.fn(),
  TFile: class TFile {
    path: string;
    basename: string;
    constructor(path: string, basename: string) {
      this.path = path;
      this.basename = basename;
    }
  },
}));

vi.mock("solid-js/web", () => ({
  render: vi.fn(() => ({ dispose: vi.fn() })),
}));

vi.mock("@/CoiChatApp", () => ({
  CoiChatApp: vi.fn(),
}));

vi.mock("@/utils/notes", () => ({
  serializeCoiNote: vi.fn(),
  deserializeCoiNote: vi.fn(),
  renameNote: vi.fn(),
  isActiveCoiNote: vi.fn(),
  deserializeCoiNoteContent: vi.fn(),
  serializeCoiNoteContent: vi.fn(),
}));

describe("ChatView", () => {
  let app: App;
  let plugin: CoIntelligencePlugin;
  let leaf: WorkspaceLeaf;
  let chatView: ChatView;
  let mockFile: TFile;

  beforeEach(() => {
    vi.useFakeTimers();

    mockFile = {
      path: "test.md",
      basename: "test",
    } as TFile;

    app = {
      workspace: {
        getActiveFile: vi.fn().mockReturnValue(mockFile),
        on: vi.fn(),
      },
      vault: {
        cachedRead: vi.fn().mockResolvedValue("# Test Content"),
        process: vi.fn(),
      },
      fileManager: {
        processFrontMatter: vi.fn(),
      },
    } as any;

    plugin = {
      app,
      registry: {
        availableModels: [],
      },
      settings: {
        defaultModel: "",
        systemPromptFolder: "",
        defaultSystemPromptNote: "",
      },
    } as any;

    leaf = {} as WorkspaceLeaf;

    chatView = new ChatView(leaf, plugin, app);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("constructor", () => {
    it("should initialize with correct properties", () => {
      expect(chatView.plugin).toBe(plugin);
      expect(chatView.app).toBe(app);
      expect(chatView.file).toBe(mockFile);
      expect(chatView.icon).toBe("bot-message-square");
      expect(chatView.messages).toEqual([]);
      expect(chatView.contextItems).toEqual({ notes: [], tags: [], sources: [] });
      expect(chatView.sources).toEqual([]);
    });

    it("should register settings change event", () => {
      expect(chatView.registerEvent).toHaveBeenCalled();
      expect(app.workspace.on).toHaveBeenCalledWith(
        "co-intelligence:settings-changed",
        expect.any(Function)
      );
    });
  });

  describe("getViewType", () => {
    it("should return correct view type", () => {
      expect(chatView.getViewType()).toBe(VIEW_TYPE_COI_CHAT);
    });
  });

  describe("getDisplayText", () => {
    it("should return file basename when file exists", () => {
      expect(chatView.getDisplayText()).toBe("test");
    });

    it("should return default text when no file", () => {
      chatView.file = null;
      expect(chatView.getDisplayText()).toBe("Co-Intelligence Chat");
    });
  });

  describe("debounceUpdateViewData", () => {
    it("should debounce multiple calls", async () => {
      const updateSpy = vi.spyOn(chatView, "updateViewData");

      await chatView.debounceUpdateViewData();
      await chatView.debounceUpdateViewData();
      await chatView.debounceUpdateViewData();

      expect(updateSpy).not.toHaveBeenCalled();

      vi.advanceTimersByTime(500);
      await vi.runAllTimersAsync();

      expect(updateSpy).toHaveBeenCalledTimes(1);
    });

    it("should clear previous timeout", async () => {
      const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");

      await chatView.debounceUpdateViewData();
      const firstTimeout = chatView["debounceTimeout"];

      await chatView.debounceUpdateViewData();

      expect(clearTimeoutSpy).toHaveBeenCalledWith(firstTimeout);
    });
  });

  describe("updateViewData", () => {
    it("should update view data with serialized content", async () => {
      const { serializeCoiNoteContent } = await import("@/utils/notes");
      const mockSerializedContent = "Serialized content";
      vi.mocked(serializeCoiNoteContent).mockResolvedValue(mockSerializedContent);

      chatView.messages = [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there!" },
      ] as ModelChatMessage[];

      await chatView.updateViewData();

      expect(app.vault.cachedRead).toHaveBeenCalledWith(mockFile);
      expect(serializeCoiNoteContent).toHaveBeenCalledWith(
        "# Test Content",
        app,
        chatView.messages,
        chatView.contextItems
      );
      expect(chatView.data).toBe(mockSerializedContent);
      expect(chatView.requestSave).toHaveBeenCalled();
    });

    it("should handle no file gracefully", async () => {
      chatView.file = null;

      const result = await chatView.updateViewData();

      expect(result).toBe("");
      expect(app.vault.cachedRead).not.toHaveBeenCalled();
    });

  });

  describe("getViewData", () => {
    it("should return current data", () => {
      chatView.data = "test data";
      expect(chatView.getViewData()).toBe("test data");
    });
  });

  describe("setViewData", () => {
    it("should set data and deserialize content", async () => {
      const { deserializeCoiNoteContent } = await import("@/utils/notes");
      const mockDeserializedData = {
        messages: [{ role: "user", content: "Deserialized" }],
        contextItems: { notes: ["note.md"], tags: [], sources: [] },
        sources: [],
      };
      vi.mocked(deserializeCoiNoteContent).mockResolvedValue(mockDeserializedData);

      app.metadataCache = {
        getFileCache: vi.fn().mockReturnValue({}),
      } as any;

      await chatView.setViewData("new data", false);

      expect(chatView.data).toBe("new data");
      expect(chatView.messages).toEqual(mockDeserializedData.messages);
      expect(chatView.contextItems).toEqual(mockDeserializedData.contextItems);
    });

    it("should handle null file gracefully", async () => {
      const { deserializeCoiNoteContent } = await import("@/utils/notes");
      const Notice = vi.mocked((await import("obsidian")).Notice);
      chatView.file = null;

      vi.mocked(deserializeCoiNoteContent).mockResolvedValue({
        messages: [],
        contextItems: { notes: [], tags: [], sources: [] },
        sources: []
      });

      await chatView.setViewData("data", false);

      expect(Notice).toHaveBeenCalledWith("Error: file is null while trying to set view data");
    });

    it("should clear when clear parameter is true", async () => {
      const clearSpy = vi.spyOn(chatView, "clear");
      app.metadataCache = {
        getFileCache: vi.fn().mockReturnValue({}),
      } as any;

      await chatView.setViewData("data", true);

      expect(clearSpy).toHaveBeenCalled();
    });
  });

  describe("handleChatChange", () => {
    it("should serialize note with new data", async () => {
      const { serializeCoiNote } = await import("@/utils/notes");
      const newMessages: ModelChatMessage[] = [
        { role: "user", content: "New message" },
      ];
      const newContextItems: ContextItems = {
        notes: ["note1.md"],
        tags: ["#tag1"],
        sources: [],
      };

      await chatView.handleChatChange({
        newMessages,
        newTitle: "test",
        contextItems: newContextItems,
        sources: [],
        lastModelId: "gpt-4",
      });

      expect(serializeCoiNote).toHaveBeenCalledWith(
        mockFile,
        app,
        newMessages,
        newContextItems,
        "gpt-4",
        []
      );
    });

    it("should rename note when title changes", async () => {
      const { renameNote } = await import("@/utils/notes");

      await chatView.handleChatChange({
        newMessages: [],
        newTitle: "New Title",
        contextItems: null,
        lastModelId: null,
      });

      expect(renameNote).toHaveBeenCalledWith(mockFile, "New Title", app, plugin);
    });

    it("should not rename when title is same as basename", async () => {
      const { renameNote } = await import("@/utils/notes");

      await chatView.handleChatChange({
        newMessages: [],
        newTitle: "test",
        contextItems: null,
        lastModelId: null,
      });

      expect(renameNote).not.toHaveBeenCalled();
    });

    it("should handle errors during serialization", async () => {
      const { serializeCoiNote } = await import("@/utils/notes");
      const Notice = vi.mocked((await import("obsidian")).Notice);
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.mocked(serializeCoiNote).mockRejectedValue(new Error("Serialization failed"));

      await chatView.handleChatChange({
        newMessages: [],
        newTitle: "",
        contextItems: null,
        lastModelId: null,
      });

      expect(Notice).toHaveBeenCalledWith("Error serializing CoiNote: Error: Serialization failed");
      expect(chatView["updating"]).toBe(false);
      
      consoleSpy.mockRestore();
    });

    it("should handle null file", async () => {
      const Notice = vi.mocked((await import("obsidian")).Notice);
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      chatView.file = null;

      await chatView.handleChatChange({
        newMessages: [],
        newTitle: "",
        contextItems: null,
        lastModelId: null,
      });

      expect(Notice).toHaveBeenCalledWith("Error: file is null while trying to handle chat change");
      
      consoleSpy.mockRestore();
    });
  });

  describe("refresh", () => {
    it("should refresh view when active", async () => {
      const { isActiveCoiNote, deserializeCoiNote } = await import("@/utils/notes");
      vi.mocked(isActiveCoiNote).mockReturnValue(true);
      vi.mocked(deserializeCoiNote).mockResolvedValue({
        messages: [],
        contextItems: { notes: [], tags: [], sources: [] },
        sources: []
      });

      app.metadataCache = {
        getFileCache: vi.fn().mockReturnValue({}),
      } as any;

      chatView.containerEl = {
        children: [null, document.createElement("div")],
      } as any;

      const onOpenSpy = vi.spyOn(chatView, "onOpen");

      await chatView.refresh();

      expect(isActiveCoiNote).toHaveBeenCalledWith(mockFile, app);
      expect(onOpenSpy).toHaveBeenCalled();
    });


    it("should handle no file", async () => {
      chatView.file = null;

      await expect(chatView.refresh()).resolves.not.toThrow();
    });
  });

  describe("clear", () => {
    it("should reset all data", () => {
      chatView.messages = [{ role: "user", content: "test" }] as ModelChatMessage[];
      chatView.contextItems = { notes: ["note.md"], tags: [], sources: [] };
      chatView.sources = [{ title: "Source", url: "https://example.com" }];
      chatView.dispose = vi.fn();
      
      chatView.clear();

      expect(chatView.messages).toEqual([]);
      expect(chatView.contextItems).toEqual({ notes: [], tags: [], sources: [] });
      expect(chatView.sources).toEqual([]);
      expect(chatView.dispose).toHaveBeenCalled();
    });
  });


});