import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the AI SDK providers before importing ModelRegistry
vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn().mockReturnValue({ id: "openai" }),
}));
vi.mock("@ai-sdk/anthropic", () => ({
  createAnthropic: vi.fn().mockReturnValue({ id: "anthropic" }),
}));
vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: vi.fn().mockReturnValue({ id: "google" }),
}));
vi.mock("@ai-sdk/perplexity", () => ({
  createPerplexity: vi.fn().mockReturnValue({ id: "perplexity" }),
}));
vi.mock("ai", () => ({
  createProviderRegistry: vi.fn().mockReturnValue({
    languageModel: vi.fn().mockReturnValue({ modelId: "mock-model" }),
    providers: {},
  }),
}));

import { ModelRegistry } from "@/services/model-registry";
import type { CoIntelligencePlugin } from "@/CoIntelligencePlugin";
import { API_KEY_SECRET_IDS, type ApiKeyProvider } from "@/settings";
import { App } from "obsidian";
import { createProviderRegistry } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createPerplexity } from "@ai-sdk/perplexity";

interface MockPluginOptions {
  settings?: Partial<CoIntelligencePlugin["settings"]>;
  apiKeys?: Partial<Record<ApiKeyProvider, string>>;
}

function createMockPlugin(options: MockPluginOptions = {}): CoIntelligencePlugin {
  const app = new App();
  for (const [provider, key] of Object.entries(options.apiKeys ?? {})) {
    if (key) {
      app.secretStorage.setSecret(
        API_KEY_SECRET_IDS[provider as ApiKeyProvider],
        key,
      );
    }
  }
  return {
    app,
    settings: {
      defaultFolder: "coi",
      defaultModel: "",
      renamingModel: "",
      systemPromptFolder: "coi/prompts",
      defaultSystemPromptNote: "",
      ...options.settings,
    },
  } as unknown as CoIntelligencePlugin;
}

describe("ModelRegistry", () => {
  beforeEach(() => {
    // Reset the singleton between tests
    // @ts-expect-error accessing private static for test reset
    ModelRegistry.instance = null;
    vi.clearAllMocks();
  });

  afterEach(() => {
    // @ts-expect-error accessing private static for test reset
    ModelRegistry.instance = null;
  });

  describe("getInstance", () => {
    it("creates a new instance when none exists", () => {
      const plugin = createMockPlugin({ apiKeys: { openai: "test-key" } });
      const registry = ModelRegistry.getInstance(plugin);
      expect(registry).toBeInstanceOf(ModelRegistry);
    });

    it("returns same instance on subsequent calls", () => {
      const plugin = createMockPlugin({ apiKeys: { openai: "test-key" } });
      const registry1 = ModelRegistry.getInstance(plugin);
      const registry2 = ModelRegistry.getInstance();
      expect(registry1).toBe(registry2);
    });

    it("throws when no instance exists and no plugin provided", () => {
      expect(() => ModelRegistry.getInstance()).toThrow(
        "No existing registry instance and no plugin instance provided.",
      );
    });
  });

  describe("provider initialization", () => {
    it("initializes OpenAI provider when API key is set", () => {
      const plugin = createMockPlugin({ apiKeys: { openai: "sk-test" } });
      ModelRegistry.getInstance(plugin);
      expect(createOpenAI).toHaveBeenCalledWith({ apiKey: "sk-test" });
    });

    it("initializes Anthropic provider when API key is set", () => {
      const plugin = createMockPlugin({ apiKeys: { anthropic: "ant-test" } });
      ModelRegistry.getInstance(plugin);
      expect(createAnthropic).toHaveBeenCalledWith({ apiKey: "ant-test" });
    });

    it("initializes Google provider when API key is set", () => {
      const plugin = createMockPlugin({ apiKeys: { google: "ggl-test" } });
      ModelRegistry.getInstance(plugin);
      expect(createGoogleGenerativeAI).toHaveBeenCalledWith({
        apiKey: "ggl-test",
      });
    });

    it("initializes Perplexity provider when API key is set", () => {
      const plugin = createMockPlugin({ apiKeys: { perplexity: "pplx-test" } });
      ModelRegistry.getInstance(plugin);
      expect(createPerplexity).toHaveBeenCalledWith({ apiKey: "pplx-test" });
    });

    it("does not initialize providers without API keys", () => {
      const plugin = createMockPlugin();
      ModelRegistry.getInstance(plugin);
      expect(createOpenAI).not.toHaveBeenCalled();
      expect(createAnthropic).not.toHaveBeenCalled();
      expect(createGoogleGenerativeAI).not.toHaveBeenCalled();
      expect(createPerplexity).not.toHaveBeenCalled();
    });

    it("initializes all providers when all keys are set", () => {
      const plugin = createMockPlugin({
        apiKeys: {
          openai: "sk-1",
          anthropic: "ant-1",
          google: "ggl-1",
          perplexity: "pplx-1",
        },
      });
      ModelRegistry.getInstance(plugin);
      expect(createOpenAI).toHaveBeenCalled();
      expect(createAnthropic).toHaveBeenCalled();
      expect(createGoogleGenerativeAI).toHaveBeenCalled();
      expect(createPerplexity).toHaveBeenCalled();
    });

    it("passes all initialized providers to createProviderRegistry", () => {
      const plugin = createMockPlugin({
        apiKeys: { openai: "sk-1", anthropic: "ant-1" },
      });
      ModelRegistry.getInstance(plugin);
      expect(createProviderRegistry).toHaveBeenCalledWith(
        expect.objectContaining({
          openai: expect.anything(),
          anthropic: expect.anything(),
        }),
      );
    });
  });

  describe("availableModels", () => {
    it("lists only models for initialized providers", () => {
      const plugin = createMockPlugin({ apiKeys: { openai: "sk-1" } });
      const registry = ModelRegistry.getInstance(plugin);
      expect(registry.availableModels.length).toBeGreaterThan(0);
      for (const model of registry.availableModels) {
        expect(model.provider).toBe("openai");
      }
    });

    it("includes models from multiple providers", () => {
      const plugin = createMockPlugin({
        apiKeys: { openai: "sk-1", anthropic: "ant-1" },
      });
      const registry = ModelRegistry.getInstance(plugin);
      const providers = new Set(registry.availableModels.map((m) => m.provider));
      expect(providers).toContain("openai");
      expect(providers).toContain("anthropic");
    });

    it("returns empty list when no providers initialized", () => {
      const plugin = createMockPlugin();
      const registry = ModelRegistry.getInstance(plugin);
      expect(registry.availableModels).toHaveLength(0);
    });
  });

  describe("getModel", () => {
    it("returns model by ID", () => {
      const plugin = createMockPlugin({ apiKeys: { openai: "sk-1" } });
      const registry = ModelRegistry.getInstance(plugin);
      const model = registry.getModel("openai:gpt-4o");
      expect(model.id).toBe("openai:gpt-4o");
      expect(model.provider).toBe("openai");
    });

    it("throws for unknown model ID", () => {
      const plugin = createMockPlugin({ apiKeys: { openai: "sk-1" } });
      const registry = ModelRegistry.getInstance(plugin);
      expect(() =>
        registry.getModel("openai:nonexistent" as never),
      ).toThrow("Model not found");
    });
  });

  describe("getDefaultModel", () => {
    it("returns first available model", () => {
      const plugin = createMockPlugin({ apiKeys: { openai: "sk-1" } });
      const registry = ModelRegistry.getInstance(plugin);
      const model = registry.getDefaultModel();
      expect(model).not.toBeNull();
      expect(model!.provider).toBe("openai");
    });

    it("returns null when no models available", () => {
      const plugin = createMockPlugin();
      const registry = ModelRegistry.getInstance(plugin);
      expect(registry.getDefaultModel()).toBeNull();
    });
  });

  describe("hasInitializedProviders", () => {
    it("returns true when providers are initialized", () => {
      const plugin = createMockPlugin({ apiKeys: { openai: "sk-1" } });
      const registry = ModelRegistry.getInstance(plugin);
      expect(registry.hasInitializedProviders()).toBe(true);
    });

    it("returns false when no providers initialized", () => {
      const plugin = createMockPlugin();
      const registry = ModelRegistry.getInstance(plugin);
      expect(registry.hasInitializedProviders()).toBe(false);
    });
  });

  describe("reinitialize", () => {
    it("re-initializes providers from current settings", () => {
      const plugin = createMockPlugin({ apiKeys: { openai: "sk-1" } });
      const registry = ModelRegistry.getInstance(plugin);

      vi.clearAllMocks();
      registry.reinitialize();

      expect(createOpenAI).toHaveBeenCalledWith({ apiKey: "sk-1" });
      expect(createProviderRegistry).toHaveBeenCalled();
    });
  });
});
