import { CoreMessage } from "ai";
import { TFile } from "obsidian";

export interface ContextItemContent {
  title: string;
  content: string;
}

/**
 * Interface for chat request parameters.
 */
export interface ChatRequest {
  requestID: string;
  modelId: ModelId; // e.g., 'openai:gpt-4-turbo'
  messages: CoreMessage[];
  systemPrompt?: string;
  context?: ContextItemContent[];
  webSearch?: boolean;
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

export interface Model {
  id: ModelId;
  provider: Provider;
  name: string;
  renaming: boolean;
  toggleWebSearch: boolean;
}

export type Tag = string;

export interface ContextItems {
  notes: TFile[];
  tags: Tag[];
  sources: Source[];
}
