import { LanguageModelV1 } from "ai";

// Provider registry types - accessing internal ai SDK structure
export interface ProviderRegistryInternal {
  providers: Record<
    string,
    {
      responses?: (model: string) => LanguageModelV1;
      [key: string]: unknown;
    }
  >;
  languageModel: (modelId: string) => LanguageModelV1;
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

// Extended language model for Google
export interface ExtendedLanguageModel extends LanguageModelV1 {
  settings?: {
    useSearchGrounding?: boolean;
  };
}

// Generic async function type for debouncing
export type AsyncFunction<
  TArgs extends readonly unknown[] = readonly unknown[],
> = (...args: TArgs) => Promise<void>;
