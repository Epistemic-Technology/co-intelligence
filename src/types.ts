import { CoreMessage } from "ai";

export interface ContextNote {
  title: string;
  content: string;
}

/**
 * Interface for chat request parameters.
 */
export interface ChatRequest {
  modelId: ModelId; // e.g., 'openai:gpt-4-turbo'
  messages: CoreMessage[];
  systemPrompt?: string;
  contextNotes?: ContextNote[];
}

export interface Source {
  url: string;
  title?: string;
}

export interface CoiNoteFrontmatter {
  "is-coi-chat": boolean;
  "coi-chat-view": boolean;
  "note-renamed": boolean;
  "linked-notes"?: string[]; // Array of paths to linked notes
  tags: string[];
}

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
