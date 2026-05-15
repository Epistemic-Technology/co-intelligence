import { LanguageModel } from "ai";
import { EventRef } from "obsidian";

// Obsidian exposes `app.commands` at runtime, but it's not in the public type
// definitions. Augment the module so `executeCommandById` can be called
// without unsafe-any casts.
declare module "obsidian" {
    interface App {
        commands: {
            executeCommandById(id: string): boolean;
        };
    }

    interface Workspace {
        on(
            name: "co-intelligence:settings-changed",
            callback: () => unknown,
            ctx?: unknown,
        ): EventRef;
        trigger(name: "co-intelligence:settings-changed"): void;
    }
}

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
