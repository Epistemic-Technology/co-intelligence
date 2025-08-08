import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ToggleChatViewCommand } from "../toggle-chat-view";
import type CoIntelligencePlugin from "@/CoIntelligencePlugin";
import type { App, TFile, WorkspaceLeaf, View, Notice } from "obsidian";
import { VIEW_TYPE_COI_CHAT } from "@/ChatView";

vi.mock("@/utils/notes", () => ({
  isCoiNote: vi.fn(),
  isActiveCoiNote: vi.fn(),
}));

vi.mock("obsidian", async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    Notice: vi.fn(),
    SuggestModal: vi.fn().mockImplementation(() => ({
      open: vi.fn(),
      close: vi.fn(),
    })),
  };
});

describe("ToggleChatViewCommand", () => {
  let app: App;
  let plugin: CoIntelligencePlugin;
  let command: ToggleChatViewCommand;
  let mockFile: TFile;
  let mockLeaf: WorkspaceLeaf;
  let mockView: View;

  beforeEach(() => {
    vi.useFakeTimers();

    mockView = {
      getState: vi.fn().mockReturnValue({ mode: "source" }),
    } as any;

    mockLeaf = {
      view: mockView,
      setViewState: vi.fn().mockResolvedValue(undefined),
    } as any;

    mockFile = {
      path: "test.md",
      basename: "test",
    } as TFile;

    app = {
      workspace: {
        getActiveFile: vi.fn(),
        getMostRecentLeaf: vi.fn().mockReturnValue(mockLeaf),
      },
      fileManager: {
        processFrontMatter: vi.fn(),
      },
    } as any;

    plugin = { app } as CoIntelligencePlugin;
    command = new ToggleChatViewCommand(plugin);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should have correct id and name", () => {
    expect(command.id).toBe("toggle-chat-view");
    expect(command.name).toBe("Toggle chat view");
  });

  describe("checkCallback", () => {
    it("should return false when checking with no active file", () => {
      app.workspace.getActiveFile = vi.fn().mockReturnValue(null);

      const result = command.checkCallback(true);

      expect(result).toBe(false);
    });

    it("should return false when checking non-COI note", async () => {
      const { isCoiNote } = await import("@/utils/notes");
      const mockedIsCoiNote = vi.mocked(isCoiNote);

      app.workspace.getActiveFile = vi.fn().mockReturnValue(mockFile);
      mockedIsCoiNote.mockReturnValue(false);

      const result = command.checkCallback(true);

      expect(result).toBe(false);
      expect(mockedIsCoiNote).toHaveBeenCalledWith(mockFile, app);
    });

    it("should return true when checking COI note", async () => {
      const { isCoiNote } = await import("@/utils/notes");
      const mockedIsCoiNote = vi.mocked(isCoiNote);

      app.workspace.getActiveFile = vi.fn().mockReturnValue(mockFile);
      mockedIsCoiNote.mockReturnValue(true);

      const result = command.checkCallback(true);

      expect(result).toBe(true);
    });

    it("should perform toggle when not checking and file is COI note", async () => {
      const { isCoiNote } = await import("@/utils/notes");
      const mockedIsCoiNote = vi.mocked(isCoiNote);
      const performToggleSpy = vi.spyOn(command as any, "performToggle");

      app.workspace.getActiveFile = vi.fn().mockReturnValue(mockFile);
      mockedIsCoiNote.mockReturnValue(true);

      command.checkCallback(false);

      expect(performToggleSpy).toHaveBeenCalledWith(mockFile);
    });

    it("should not perform toggle when file is not COI note", async () => {
      const { isCoiNote } = await import("@/utils/notes");
      const mockedIsCoiNote = vi.mocked(isCoiNote);
      const performToggleSpy = vi.spyOn(command as any, "performToggle");

      app.workspace.getActiveFile = vi.fn().mockReturnValue(mockFile);
      mockedIsCoiNote.mockReturnValue(false);

      command.checkCallback(false);

      expect(performToggleSpy).not.toHaveBeenCalled();
    });
  });

  describe("performToggle", () => {
    it("should toggle from active to source view", async () => {
      const { isActiveCoiNote } = await import("@/utils/notes");
      const mockedIsActiveCoiNote = vi.mocked(isActiveCoiNote);
      mockedIsActiveCoiNote.mockReturnValue(true);

      const processFrontMatterCallback = vi.fn();
      app.fileManager.processFrontMatter = vi.fn().mockImplementation(async (file, callback) => {
        const frontmatter = { "coi-chat-view": true };
        callback(frontmatter);
        processFrontMatterCallback(frontmatter);
        return Promise.resolve();
      });

      const togglePromise = command["performToggle"](mockFile);
      await vi.runAllTimersAsync();
      await togglePromise;

      expect(processFrontMatterCallback).toHaveBeenCalledWith(
        expect.objectContaining({ "coi-chat-view": false })
      );

      expect(mockLeaf.setViewState).toHaveBeenCalledWith(
        {
          type: "markdown",
          state: { mode: "source" },
          popstate: true,
        },
        { focus: true }
      );
    });

    it("should toggle from source to chat view", async () => {
      const { isActiveCoiNote } = await import("@/utils/notes");
      const mockedIsActiveCoiNote = vi.mocked(isActiveCoiNote);
      mockedIsActiveCoiNote.mockReturnValue(false);

      const processFrontMatterCallback = vi.fn();
      app.fileManager.processFrontMatter = vi.fn().mockImplementation(async (file, callback) => {
        const frontmatter = { "coi-chat-view": false };
        callback(frontmatter);
        processFrontMatterCallback(frontmatter);
        return Promise.resolve();
      });

      const togglePromise = command["performToggle"](mockFile);
      await vi.runAllTimersAsync();
      await togglePromise;

      expect(processFrontMatterCallback).toHaveBeenCalledWith(
        expect.objectContaining({ "coi-chat-view": true })
      );

      expect(mockLeaf.setViewState).toHaveBeenCalledWith(
        {
          type: VIEW_TYPE_COI_CHAT,
          state: { mode: "source" },
          popstate: true,
        },
        { focus: true }
      );
    });
  });

  describe("error handling", () => {
    it("should show notice when no leaf found for default editor", async () => {
      const Notice = vi.mocked((await import("obsidian")).Notice);
      app.workspace.getMostRecentLeaf = vi.fn().mockReturnValue(null);

      await command["openInDefaultEditor"](mockFile);

      expect(Notice).toHaveBeenCalledWith(
        "Error: no leaf found while opening chat in default editor"
      );
    });

    it("should show notice when no leaf found for chat view", async () => {
      const Notice = vi.mocked((await import("obsidian")).Notice);
      app.workspace.getMostRecentLeaf = vi.fn().mockReturnValue(null);

      await command["openInChatView"](mockFile);

      expect(Notice).toHaveBeenCalledWith(
        "Error: no leaf found while opening chat in chat view"
      );
    });

    it("should log error to console when no leaf found", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation();
      app.workspace.getMostRecentLeaf = vi.fn().mockReturnValue(null);

      await command["openInDefaultEditor"](mockFile);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "No leaf found while opening chat in default editor"
      );

      consoleErrorSpy.mockRestore();
    });
  });
});