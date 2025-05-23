import { createProviderRegistry, LanguageModel } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createPerplexity } from "@ai-sdk/perplexity";
import { Model, ModelId, Provider } from "@/types";
import type { CoIntelligencePlugin } from "@/CoIntelligencePlugin";

export class ModelRegistry {
  private plugin: CoIntelligencePlugin | null = null;
  public providerRegistry: ReturnType<typeof createProviderRegistry> | null =
    null;
  public availableModels: Model[] = [];

  private static instance: ModelRegistry | null = null;

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

  public initialize(pluginInstance: CoIntelligencePlugin): void {
    this.plugin = pluginInstance;
    this.initializeProviders();
  }

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

    this.providerRegistry = createProviderRegistry(providers);

    this.updateAvailableModels(Object.keys(providers));
  }

  private updateAvailableModels(initializedProviders: string[]): void {
    const allModels: Model[] = [
      {
        id: "openai:o1",
        provider: "openai",
        name: "OpenAI O1",
        renaming: false,
      },
      {
        id: "openai:gpt-4o-mini",
        provider: "openai",
        name: "OpenAI GPT-4o Mini",
        renaming: true,
      },
      {
        id: "openai:gpt-4o",
        provider: "openai",
        name: "OpenAI GPT-4o",
        renaming: true,
      },
      {
        id: "openai:gpt-4.1-nano",
        provider: "openai",
        name: "OpenAI GPT-4.1 Nano",
        renaming: true,
      },
      {
        id: "openai:gpt-4.1-mini",
        provider: "openai",
        name: "OpenAI GPT-4.1 Mini",
        renaming: true,
      },
      {
        id: "openai:gpt-4.1",
        provider: "openai",
        name: "OpenAI GPT-4.1",
        renaming: true,
      },
      {
        id: "anthropic:claude-3-7-sonnet-latest",
        provider: "anthropic",
        name: "Anthropic Claude 3.7 Sonnet",
        renaming: true,
      },
      {
        id: "anthropic:claude-3-opus-latest",
        provider: "anthropic",
        name: "Anthropic Claude 3.7 Opus",
        renaming: false,
      },
      {
        id: "google:gemini-2.0-flash",
        provider: "google",
        name: "Google Gemini 2.0 Flash",
        renaming: true,
      },
      {
        id: "google:gemini-1.5-pro",
        provider: "google",
        name: "Google Gemini 2.5 Pro Exp",
        renaming: false,
      },
      {
        id: "perplexity:sonar",
        provider: "perplexity",
        name: "Perplexity Sonar",
        renaming: false,
      },
      {
        id: "perplexity:sonar-deep-research",
        provider: "perplexity",
        name: "Perplexity Sonar Deep Research",
        renaming: false,
      },
      {
        id: "perplexity:sonar-reasoning",
        provider: "perplexity",
        name: "Perplexity Sonar Reasoning",
        renaming: false,
      },
    ];

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

  public getLanguageModel(modelId: ModelId): LanguageModel {
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
    const provider = languageModel.provider as Provider;
    return languageModel;
  }

  public getDefaultModel(): Model | null {
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

  public hasInitializedProviders(): boolean {
    return this.availableModels.length > 0;
  }

  public reinitialize(): void {
    if (this.plugin) {
      this.initializeProviders();
    }
  }
}
