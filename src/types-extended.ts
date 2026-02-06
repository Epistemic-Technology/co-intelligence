import { LanguageModel } from "ai";

// Provider registry types - accessing internal ai SDK structure
export interface ProviderRegistryInternal {
  providers: Record<
    string,
    {
      responses?: (model: string) => LanguageModel;
      [key: string]: unknown;
    }
  >;
  languageModel: (modelId: string) => LanguageModel;
}

// Provider-specific options
export interface OpenAIProviderOptions {
  reasoningSummary?: string;
  [key: string]: unknown;
}

export interface ProviderOptions {
  openai?: OpenAIProviderOptions;
  anthropic?: Record<string, unknown>;
  google?: Record<string, unknown>;
  perplexity?: Record<string, unknown>;
  [key: string]: Record<string, unknown> | undefined;
}

// Generic async function type for debouncing
export type AsyncFunction<
  TArgs extends readonly unknown[] = readonly unknown[],
> = (...args: TArgs) => Promise<void>;
