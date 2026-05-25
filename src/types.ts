import { ModelMessage } from "ai";
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
  messages: ModelChatMessage[];
  systemPrompt?: string;
  context?: ContextItemContent[];
  webSearch?: boolean;
}

export interface Source {
  url: string;
  title?: string;
}

export type ModelChatMessage = ModelMessage & {
  isReasoning?: boolean;
};

export interface CoiNoteFrontmatter {
  "is-coi-chat": boolean;
  "coi-chat-view": boolean;
  "note-renamed": boolean;
  "coi-session-id"?: string;
  "linked-notes"?: string[];
  "linked-tags"?: string[];
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
  streaming: boolean;
}

export type Tag = string;

export interface ContextItems {
  notes: TFile[];
  tags: Tag[];
  sources: Source[];
}
