import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ModelRegistry } from "@/services/model-registry";
import type { CoIntelligencePlugin } from "@/CoIntelligencePlugin";

// Mock the AI SDK providers
vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn(() => "mocked-openai-provider"),
}));

vi.mock("@ai-sdk/anthropic", () => ({
  createAnthropic: vi.fn(() => "mocked-anthropic-provider"),
}));

vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: vi.fn(() => "mocked-google-provider"),
}));

vi.mock("@ai-sdk/perplexity", () => ({
  createPerplexity: vi.fn(() => "mocked-perplexity-provider"),
}));

vi.mock("ai", () => ({
  createProviderRegistry: vi.fn((providers) => ({
    providers,
    languageModel: vi.fn((modelId: string) => {
      if (modelId.startsWith("openai:")) return { provider: "openai" };
      if (modelId.startsWith("anthropic:")) return { provider: "anthropic" };
      if (modelId.startsWith("google:")) return { provider: "google" };
      if (modelId.startsWith("perplexity:")) return { provider: "perplexity" };
      return null;
    }),
  })),
}));

vi.mock("obsidian", () => ({
  Notice: vi.fn(),
}));

describe("ModelRegistry", () => {
  let mockPlugin: CoIntelligencePlugin;

  beforeEach(() => {
    // Reset the singleton instance before each test
    (ModelRegistry as any).instance = null;

    mockPlugin = {
      settings: {
        openaiApiKey: "",
        anthropicApiKey: "",
        googleApiKey: "",
        perplexityApiKey: "",
      },
    } as CoIntelligencePlugin;
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Clean up singleton instance
    (ModelRegistry as any).instance = null;
  });

  describe("singleton pattern", () => {
    it("should create a new instance when none exists and plugin provided", () => {
      const registry = ModelRegistry.getInstance(mockPlugin);
      expect(registry).toBeInstanceOf(ModelRegistry);
    });

    it("should return the same instance on subsequent calls", () => {
      const registry1 = ModelRegistry.getInstance(mockPlugin);
      const registry2 = ModelRegistry.getInstance();

      expect(registry1).toBe(registry2);
    });

    it("should throw error when no instance exists and no plugin provided", () => {
      expect(() => {
        ModelRegistry.getInstance();
      }).toThrow(
        "No existing registry instance and no plugin instance provided.",
      );
    });
  });

  describe("provider initialization", () => {
    it("should initialize no providers when no API keys provided", () => {
      const registry = ModelRegistry.getInstance(mockPlugin);

      expect(registry.availableModels).toHaveLength(0);
      expect(registry.hasInitializedProviders()).toBe(false);
    });

    it("should initialize OpenAI provider when API key provided", () => {
      mockPlugin.settings.openaiApiKey = "sk-test-key";
      const registry = ModelRegistry.getInstance(mockPlugin);

      const openaiModels = registry.availableModels.filter(
        (m) => m.provider === "openai",
      );
      expect(openaiModels.length).toBeGreaterThan(0);
      expect(registry.hasInitializedProviders()).toBe(true);
    });

    it("should initialize Anthropic provider when API key provided", () => {
      mockPlugin.settings.anthropicApiKey = "sk-ant-test-key";
      const registry = ModelRegistry.getInstance(mockPlugin);

      const anthropicModels = registry.availableModels.filter(
        (m) => m.provider === "anthropic",
      );
      expect(anthropicModels.length).toBeGreaterThan(0);
      expect(registry.hasInitializedProviders()).toBe(true);
    });

    it("should initialize Google provider when API key provided", () => {
      mockPlugin.settings.googleApiKey = "google-test-key";
      const registry = ModelRegistry.getInstance(mockPlugin);

      const googleModels = registry.availableModels.filter(
        (m) => m.provider === "google",
      );
      expect(googleModels.length).toBeGreaterThan(0);
      expect(registry.hasInitializedProviders()).toBe(true);
    });

    it("should initialize Perplexity provider when API key provided", () => {
      mockPlugin.settings.perplexityApiKey = "pplx-test-key";
      const registry = ModelRegistry.getInstance(mockPlugin);

      const perplexityModels = registry.availableModels.filter(
        (m) => m.provider === "perplexity",
      );
      expect(perplexityModels.length).toBeGreaterThan(0);
      expect(registry.hasInitializedProviders()).toBe(true);
    });

    it("should initialize multiple providers when multiple API keys provided", () => {
      mockPlugin.settings.openaiApiKey = "sk-test-key";
      mockPlugin.settings.anthropicApiKey = "sk-ant-test-key";

      const registry = ModelRegistry.getInstance(mockPlugin);

      const openaiModels = registry.availableModels.filter(
        (m) => m.provider === "openai",
      );
      const anthropicModels = registry.availableModels.filter(
        (m) => m.provider === "anthropic",
      );

      expect(openaiModels.length).toBeGreaterThan(0);
      expect(anthropicModels.length).toBeGreaterThan(0);
      expect(registry.hasInitializedProviders()).toBe(true);
    });
  });

  describe("model retrieval", () => {
    beforeEach(() => {
      mockPlugin.settings.openaiApiKey = "sk-test-key";
      mockPlugin.settings.anthropicApiKey = "sk-ant-test-key";
    });

    it("should retrieve a model by ID", () => {
      const registry = ModelRegistry.getInstance(mockPlugin);
      const model = registry.getModel("openai:gpt-4o");

      expect(model).toBeDefined();
      expect(model.id).toBe("openai:gpt-4o");
      expect(model.provider).toBe("openai");
      expect(model.name).toBe("OpenAI GPT-4o");
    });

    it("should throw error for non-existent model", () => {
      const registry = ModelRegistry.getInstance(mockPlugin);

      expect(() => {
        registry.getModel("nonexistent:model" as any);
      }).toThrow("Model not found: nonexistent:model");
    });

    it("should get language model from provider registry", () => {
      const registry = ModelRegistry.getInstance(mockPlugin);
      const languageModel = registry.getLanguageModel("openai:gpt-4o");

      expect(languageModel).toBeDefined();
      expect(languageModel.provider).toBe("openai");
    });

    it("should return default model when available", () => {
      const registry = ModelRegistry.getInstance(mockPlugin);
      const defaultModel = registry.getDefaultModel();

      expect(defaultModel).toBeDefined();
      expect(registry.availableModels).toContain(defaultModel);
    });

    it("should return null as default model when no providers initialized", () => {
      // Create registry without API keys
      mockPlugin.settings = {
        openaiApiKey: "",
        anthropicApiKey: "",
        googleApiKey: "",
        perplexityApiKey: "",
        defaultFolder: "",
        defaultModel: "" as any,
        renamingModel: "" as any,
        systemPromptFolder: "",
        defaultSystemPromptNote: ""
      };

      const registry = ModelRegistry.getInstance(mockPlugin);
      const defaultModel = registry.getDefaultModel();

      expect(defaultModel).toBeNull();
    });
  });

  describe("reinitialization", () => {
    it("should reinitialize providers when reinitialize is called", () => {
      // Start with no API keys
      const registry = ModelRegistry.getInstance(mockPlugin);
      expect(registry.availableModels).toHaveLength(0);

      // Add API key and reinitialize
      mockPlugin.settings.openaiApiKey = "sk-test-key";
      registry.reinitialize();

      expect(registry.availableModels.length).toBeGreaterThan(0);
      expect(registry.hasInitializedProviders()).toBe(true);
    });

    it("should update available models after reinitialization", () => {
      // Start with OpenAI only
      mockPlugin.settings.openaiApiKey = "sk-test-key";
      const registry = ModelRegistry.getInstance(mockPlugin);

      const initialModelCount = registry.availableModels.length;
      expect(
        registry.availableModels.every((m) => m.provider === "openai"),
      ).toBe(true);

      // Add Anthropic and reinitialize
      mockPlugin.settings.anthropicApiKey = "sk-ant-test-key";
      registry.reinitialize();

      expect(registry.availableModels.length).toBeGreaterThan(
        initialModelCount,
      );
      expect(
        registry.availableModels.some((m) => m.provider === "anthropic"),
      ).toBe(true);
    });
  });

  describe("model properties", () => {
    beforeEach(() => {
      mockPlugin.settings.openaiApiKey = "sk-test-key";
      mockPlugin.settings.anthropicApiKey = "sk-ant-test-key";
    });

    it("should have correct model properties for OpenAI models", () => {
      const registry = ModelRegistry.getInstance(mockPlugin);
      const gpt4o = registry.getModel("openai:gpt-4o");

      expect(gpt4o.renaming).toBe(true);
      expect(gpt4o.toggleWebSearch).toBe(true);
      expect(gpt4o.streaming).toBe(true);
    });

    it("should have correct model properties for O1 models (no web search)", () => {
      const registry = ModelRegistry.getInstance(mockPlugin);
      const o1 = registry.getModel("openai:o1");

      expect(o1.renaming).toBe(false);
      expect(o1.toggleWebSearch).toBe(false);
      expect(o1.streaming).toBe(true);
    });

    it("should have correct model properties for Claude models", () => {
      const registry = ModelRegistry.getInstance(mockPlugin);
      const claude = registry.getModel("anthropic:claude-4-sonnet-20250514");

      expect(claude.renaming).toBe(true);
      expect(claude.toggleWebSearch).toBe(false);
      expect(claude.streaming).toBe(true);
    });
  });
});
