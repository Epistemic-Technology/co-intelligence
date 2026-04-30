import { createProviderRegistry, LanguageModel } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createPerplexity } from "@ai-sdk/perplexity";
import { Model, ModelId } from "@/types";
import { ProviderRegistryInternal } from "@/types-extended";
import type { CoIntelligencePlugin } from "@/CoIntelligencePlugin";
import { getApiKey } from "@/settings";
import { Notice } from "obsidian";

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
    const app = this.plugin.app;
    const providers: Record<
      string,
      ReturnType<
        | typeof createOpenAI
        | typeof createAnthropic
        | typeof createGoogleGenerativeAI
        | typeof createPerplexity
      >
    > = {};

    const openaiKey = getApiKey(app, "openai");
    if (openaiKey) {
      providers.openai = createOpenAI({ apiKey: openaiKey });
    }

    const anthropicKey = getApiKey(app, "anthropic");
    if (anthropicKey) {
      providers.anthropic = createAnthropic({ apiKey: anthropicKey });
    }

    const googleKey = getApiKey(app, "google");
    if (googleKey) {
      providers.google = createGoogleGenerativeAI({ apiKey: googleKey });
    }

    const perplexityKey = getApiKey(app, "perplexity");
    if (perplexityKey) {
      providers.perplexity = createPerplexity({ apiKey: perplexityKey });
    }

    this.providerRegistry = createProviderRegistry(providers);

    this.updateAvailableModels(Object.keys(providers));
  }

  private updateAvailableModels(initializedProviders: string[]): void {
    const allModels: Model[] = [
      {
        id: "openai:gpt-4o",
        provider: "openai",
        name: "OpenAI GPT-4o",
        renaming: true,
        toggleWebSearch: true,
        streaming: true,
      },
      {
        id: "openai:gpt-4.1",
        provider: "openai",
        name: "OpenAI GPT-4.1",
        renaming: true,
        toggleWebSearch: true,
        streaming: true,
      },
      {
        id: "openai:gpt-4.1-nano",
        provider: "openai",
        name: "OpenAI GPT-4.1 Nano",
        renaming: true,
        toggleWebSearch: true,
        streaming: true,
      },
      {
        id: "openai:gpt-4.1-mini",
        provider: "openai",
        name: "OpenAI GPT-4.1 Mini",
        renaming: true,
        toggleWebSearch: true,
        streaming: true,
      },
      {
        id: "openai:o1",
        provider: "openai",
        name: "OpenAI O1",
        renaming: false,
        toggleWebSearch: false,
        streaming: true,
      },
      {
        id: "openai:o3",
        provider: "openai",
        name: "OpenAI O3",
        renaming: false,
        toggleWebSearch: false,
        streaming: true,
      },
      {
        id: "anthropic:claude-4-sonnet-20250514",
        provider: "anthropic",
        name: "Anthropic Claude 4 Sonnet",
        renaming: true,
        toggleWebSearch: false,
        streaming: true,
      },
      {
        id: "anthropic:claude-4-opus-20250514",
        provider: "anthropic",
        name: "Anthropic Claude 4 Opus",
        renaming: false,
        toggleWebSearch: false,
        streaming: true,
      },
      {
        id: "google:gemini-2.0-flash",
        provider: "google",
        name: "Google Gemini 2.0 Flash",
        renaming: false,
        toggleWebSearch: true,
        streaming: true,
      },
      {
        id: "google:gemini-2.5-flash-preview-04-17",
        provider: "google",
        name: "Google Gemini 2.5 Flash Preview",
        renaming: true,
        toggleWebSearch: true,
        streaming: true,
      },
      {
        id: "google:gemini-2.5-pro-preview-05-06",
        provider: "google",
        name: "Google Gemini 2.5 Pro Preview",
        renaming: true,
        toggleWebSearch: false,
        streaming: true,
      },
      {
        id: "perplexity:sonar",
        provider: "perplexity",
        name: "Perplexity Sonar",
        renaming: false,
        toggleWebSearch: false,
        streaming: true,
      },
      {
        id: "perplexity:sonar-deep-research",
        provider: "perplexity",
        name: "Perplexity Sonar Deep Research",
        renaming: false,
        toggleWebSearch: false,
        streaming: true,
      },
      {
        id: "perplexity:sonar-reasoning",
        provider: "perplexity",
        name: "Perplexity Sonar Reasoning",
        renaming: false,
        toggleWebSearch: false,
        streaming: true,
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

    // For openAI, we use the responses API, which requires different handling
    // because it doesn't seem to be exposed in the same way as the completions
    // API models by the ai sdk.
    const model = this.getModel(modelId);
    const [provider, providerModelId] = model.id.split(":");
    if (provider == "openai") {
      try {
        const providerRegistry = this
          .providerRegistry as unknown as ProviderRegistryInternal;
        const openaiProvider = providerRegistry.providers.openai;
        if (openaiProvider.responses) {
          return openaiProvider.responses(providerModelId);
        }
        throw new Error("OpenAI responses method not available");
      } catch (error) {
        new Notice("Error: could not fetch responses model");
        console.error(`Error fetching OpenAI responses model: ${String(error)}`);
        //fall through to default behavior
      }
    }

    // The modelId is in the format 'provider:model'
    // For example, 'openai:gpt-4-turbo'
    const languageModel = this.providerRegistry.languageModel(modelId);
    if (!languageModel) {
      throw new Error(`Model not found: ${modelId}`);
    }
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
