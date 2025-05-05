import { createProviderRegistry, LanguageModel } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createPerplexity } from "@ai-sdk/perplexity";
import type { CoIntelligencePlugin } from "@/CoIntelligencePlugin";

export type ModelId =
  | `openai:${string}`
  | `anthropic:${string}`
  | `google:${string}`
  | `perplexity:${string}`;

export type Provider = "openai" | "anthropic" | "google" | "perplexity";

export type Model = {
  id: ModelId;
  provider: Provider;
  name: string;
};

export class ModelRegistry {
  private plugin: CoIntelligencePlugin | null = null;
  public providerRegistry: ReturnType<typeof createProviderRegistry> | null =
    null;
  public availableModels: Model[] = [];

  private static instance: ModelRegistry | null = null;

  // Singleton pattern to ensure only one instance exists
  public static getInstance(
    pluginInstance: CoIntelligencePlugin | null = null,
  ): ModelRegistry {
    if (!ModelRegistry.instance) {
      if (!pluginInstance) {
        throw new Error(
          "No existing registry instance and no plugin instance provided.",
        );
      }
      ModelRegistry.instance = new ModelRegistry(pluginInstance);
    }
    return ModelRegistry.instance;
  }

  private constructor(pluginInstance: CoIntelligencePlugin) {
    this.plugin = pluginInstance;
    this.initializeProviders();
  }

  // Initialize the model registry with the plugin instance
  public initialize(pluginInstance: CoIntelligencePlugin): void {
    this.plugin = pluginInstance;
    this.initializeProviders();
  }

  // Initialize providers based on available API keys
  private initializeProviders(): void {
    if (!this.plugin) {
      throw new Error("Plugin instance not initialized");
    }
    const settings = this.plugin.settings;
    const providers: Record<string, any> = {};

    if (settings.openaiApiKey) {
      providers.openai = createOpenAI({ apiKey: settings.openaiApiKey });
    }

    if (settings.anthropicApiKey) {
      providers.anthropic = createAnthropic({
        apiKey: settings.anthropicApiKey,
      });
    }

    if (settings.googleApiKey) {
      providers.google = createGoogleGenerativeAI({
        apiKey: settings.googleApiKey,
      });
    }

    if (settings.perplexityApiKey) {
      providers.perplexity = createPerplexity({
        apiKey: settings.perplexityApiKey,
      });
    }

    // Initialize provider registry with available providers
    this.providerRegistry = createProviderRegistry(providers);

    // Update available models based on initialized providers
    this.updateAvailableModels(Object.keys(providers));
  }

  // Update the list of available models based on initialized providers
  private updateAvailableModels(initializedProviders: string[]): void {
    const allModels: Model[] = [
      // {
      //   id: "openai:o3",
      //   provider: "openai",
      //   name: "OpenAI O3",
      // },
      {
        id: "openai:gpt-4o",
        provider: "openai",
        name: "OpenAI GPT-4o",
      },
      {
        id: "openai:gpt-4.1",
        provider: "openai",
        name: "OpenAI GPT-4.1",
      },
      {
        id: "anthropic:claude-3-7-sonnet-latest",
        provider: "anthropic",
        name: "Anthropic Claude 3.7 Sonnet",
      },
      {
        id: "anthropic:claude-3-opus-latest",
        provider: "anthropic",
        name: "Anthropic Claude 3.7 Opus",
      },
      {
        id: "google:gemini-2.0-flash-live-001",
        provider: "google",
        name: "Google Gemini 2.0 Flash",
      },
      {
        id: "google:gemini-2.5-pro-exp-02-05",
        provider: "google",
        name: "Google Gemini 2.5 Pro Exp",
      },
      {
        id: "perplexity:sonar",
        provider: "perplexity",
        name: "Perplexity Sonar",
      },
      {
        id: "perplexity:sonar-deep-research",
        provider: "perplexity",
        name: "Perplexity Sonar Deep Research",
      },
      {
        id: "perplexity:sonar-reasoning",
        provider: "perplexity",
        name: "Perplexity Sonar Reasoning",
      },
    ];

    // Filter models to only include those with initialized providers
    this.availableModels = allModels.filter((model) =>
      initializedProviders.includes(model.provider),
    );
  }

  public getModel(modelId: ModelId) {
    const model = this.availableModels.find((model) => model.id === modelId);
    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }
    return model;
  }

  // Get a specific model by ID
  public getLanguageModel(modelId: ModelId): LanguageModel {
    // Ensure the provider registry is initialized
    if (!this.providerRegistry) {
      throw new Error(
        "Provider registry not initialized. Make sure API keys are configured.",
      );
    }

    // The modelId is in the format 'provider:model'
    // For example, 'openai:gpt-4-turbo'
    const languageModel = this.providerRegistry.languageModel(modelId);
    if (!languageModel) {
      throw new Error(`Model not found: ${modelId}`);
    }
    // Ensure that the provider name conforms to our Provider type
    const provider = languageModel.provider as Provider;
    return languageModel;
  }

  public getDefaultModel(): Model | null {
    // Ensure the provider registry is initialized
    if (!this.providerRegistry) {
      throw new Error(
        "Provider registry not initialized. Make sure API keys are configured.",
      );
    }
    if (!this.availableModels.length) {
      return null;
    }
    const firstAvailableModel = this.availableModels[0];
    return firstAvailableModel;
  }

  // Check if any providers are initialized
  public hasInitializedProviders(): boolean {
    return this.availableModels.length > 0;
  }

  // Reinitialize providers (useful after settings change)
  public reinitialize(): void {
    if (this.plugin) {
      this.initializeProviders();
    }
  }
}
