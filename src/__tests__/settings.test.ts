import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CoIntelligenceSettingsTab, DEFAULT_SETTINGS } from "../settings";
import type { App, Setting } from "obsidian";
import type CoIntelligencePlugin from "@/CoIntelligencePlugin";

vi.mock("obsidian", () => ({
  PluginSettingTab: class PluginSettingTab {
    app: any;
    plugin: any;
    containerEl: any;
    constructor(app: any, plugin: any) {
      this.app = app;
      this.plugin = plugin;
      this.containerEl = {
        empty: vi.fn(),
        createEl: vi.fn(),
        createDiv: vi.fn(),
        querySelectorAll: vi.fn(),
      };
    }
  },
  Setting: vi.fn().mockImplementation(() => ({
    setName: vi.fn().mockReturnThis(),
    setDesc: vi.fn().mockReturnThis(),
    addText: vi.fn().mockReturnThis(),
    addDropdown: vi.fn().mockReturnThis(),
  })),
  normalizePath: vi.fn((path: string) =>
    path.replace(/\/+/g, "/").replace(/\/$/, ""),
  ),
}));

describe("settings", () => {
  describe("DEFAULT_SETTINGS", () => {
    it("should have all required fields with default values", () => {
      expect(DEFAULT_SETTINGS).toEqual({
        openaiApiKey: "",
        anthropicApiKey: "",
        googleApiKey: "",
        perplexityApiKey: "",
        defaultFolder: "coi",
        defaultModel: "",
        renamingModel: "",
        systemPromptFolder: "coi/prompts",
        defaultSystemPromptNote: "",
      });
    });
  });

  describe("CoIntelligenceSettingsTab", () => {
    let app: App;
    let plugin: CoIntelligencePlugin;
    let settingsTab: CoIntelligenceSettingsTab;
    let mockElement: any;

    beforeEach(() => {
      vi.useFakeTimers();

      mockElement = {
        empty: vi.fn(),
        createEl: vi.fn().mockReturnValue({
          createEl: vi.fn().mockReturnValue({
            createEl: vi.fn(),
            appendChild: vi.fn(),
            setAttribute: vi.fn(),
          }),
        }),
        createDiv: vi.fn().mockReturnValue({
          createDiv: vi.fn().mockReturnValue({
            createEl: vi.fn().mockReturnValue({
              createEl: vi.fn(),
            }),
          }),
          createEl: vi.fn().mockReturnValue({
            createEl: vi.fn(),
            appendChild: vi.fn(),
          }),
        }),
        querySelectorAll: vi.fn().mockReturnValue([]),
      };

      app = {
        vault: {
          getMarkdownFiles: vi.fn().mockReturnValue([
            { path: "coi/prompts/prompt1.md", basename: "prompt1" },
            { path: "coi/prompts/prompt2.md", basename: "prompt2" },
          ]),
        },
        workspace: {
          trigger: vi.fn(),
        },
      } as any;

      plugin = {
        settings: { ...DEFAULT_SETTINGS },
        saveSettings: vi.fn().mockResolvedValue(undefined),
        registry: {
          availableModels: [
            { id: "gpt-4", name: "GPT-4", renaming: true },
            { id: "claude-3", name: "Claude 3", renaming: true },
            { id: "gemini-pro", name: "Gemini Pro", renaming: false },
          ],
          reinitialize: vi.fn(),
        },
      } as any;

      settingsTab = new CoIntelligenceSettingsTab(app, plugin);
      settingsTab.containerEl = mockElement;
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    describe("createDebouncedChangeHandler", () => {
      it("should debounce multiple changes", async () => {
        const handler = settingsTab["createDebouncedChangeHandler"](
          "openaiApiKey",
          true,
          false,
        );

        handler("key1");
        handler("key2");
        handler("key3");

        expect(plugin.saveSettings).not.toHaveBeenCalled();

        vi.advanceTimersByTime(500);
        await vi.runAllTimersAsync();

        expect(plugin.saveSettings).toHaveBeenCalledTimes(1);
        expect(plugin.settings.openaiApiKey).toBe("key3");
      });

      it("should reinitialize registry when required", async () => {
        const handler = settingsTab["createDebouncedChangeHandler"](
          "anthropicApiKey",
          true,
          false,
        );

        handler("new-key");

        vi.advanceTimersByTime(500);
        await vi.runAllTimersAsync();

        expect(plugin.registry.reinitialize).toHaveBeenCalled();
      });

      it("should trigger settings-changed event", async () => {
        const handler = settingsTab["createDebouncedChangeHandler"](
          "defaultFolder",
          false,
          false,
        );

        handler("new-folder");

        vi.advanceTimersByTime(500);
        await vi.runAllTimersAsync();

        expect(app.workspace.trigger).toHaveBeenCalledWith(
          "co-intelligence:settings-changed",
        );
      });

      it("should normalize folder paths", async () => {
        const handler = settingsTab["createDebouncedChangeHandler"](
          "defaultFolder",
          false,
          false,
        );

        handler("folder//with///slashes/");

        vi.advanceTimersByTime(500);
        await vi.runAllTimersAsync();

        expect(plugin.settings.defaultFolder).toBe("folder/with/slashes");
      });

      it("should handle multiple pending changes for different settings", async () => {
        const handler1 = settingsTab["createDebouncedChangeHandler"](
          "openaiApiKey",
          true,
          false,
        );
        const handler2 = settingsTab["createDebouncedChangeHandler"](
          "anthropicApiKey",
          true,
          false,
        );

        handler1("openai-key");
        handler2("anthropic-key");

        vi.advanceTimersByTime(500);
        await vi.runAllTimersAsync();

        expect(plugin.settings.openaiApiKey).toBe("openai-key");
        expect(plugin.settings.anthropicApiKey).toBe("anthropic-key");
        expect(plugin.saveSettings).toHaveBeenCalledTimes(1);
        expect(plugin.registry.reinitialize).toHaveBeenCalledTimes(1);
      });
    });
  });
});
