import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("ai", () => ({
  streamText: vi.fn().mockReturnValue({
    textStream: (async function* () {
      yield "Hello";
    })(),
    text: Promise.resolve("Hello"),
  }),
  generateText: vi.fn().mockResolvedValue({ text: "Chat summary title" }),
  createProviderRegistry: vi.fn().mockReturnValue({
    languageModel: vi.fn().mockReturnValue({
      modelId: "mock-model",
      provider: "openai",
    }),
    providers: {},
  }),
}));

vi.mock("@ai-sdk/openai", () => ({
  openai: {
    tools: {
      webSearchPreview: vi.fn().mockReturnValue({ type: "web_search" }),
    },
  },
  createOpenAI: vi.fn().mockReturnValue({ id: "openai" }),
}));

vi.mock("@ai-sdk/google", () => ({
  google: {
    tools: {
      googleSearch: vi.fn().mockReturnValue({ type: "google_search" }),
    },
  },
  createGoogleGenerativeAI: vi.fn().mockReturnValue({ id: "google" }),
}));

vi.mock("@ai-sdk/anthropic", () => ({
  createAnthropic: vi.fn().mockReturnValue({ id: "anthropic" }),
}));

vi.mock("@ai-sdk/perplexity", () => ({
  createPerplexity: vi.fn().mockReturnValue({ id: "perplexity" }),
}));

import {
  generateChatResponse,
  cancelChatResponse,
  generateChatTitle,
} from "@/services/model-service";
import { ModelRegistry } from "@/services/model-registry";
import { streamText, generateText } from "ai";
import type { ChatRequest, ModelId } from "@/types";
import type CoIntelligencePlugin from "@/CoIntelligencePlugin";
import { API_KEY_SECRET_IDS } from "@/settings";
import { App } from "obsidian";

function createMockPlugin(
  settings: Partial<CoIntelligencePlugin["settings"]> = {},
): CoIntelligencePlugin {
  const app = new App();
  app.secretStorage.setSecret(API_KEY_SECRET_IDS.openai, "sk-test");
  return {
    app,
    settings: {
      defaultFolder: "coi",
      defaultModel: "",
      renamingModel: "openai:gpt-4o" as ModelId,
      systemPromptFolder: "coi/prompts",
      defaultSystemPromptNote: "",
      ...settings,
    },
  } as unknown as CoIntelligencePlugin;
}

function createMockRegistry(): ModelRegistry {
  const plugin = createMockPlugin();
  // @ts-expect-error accessing private static for test reset
  ModelRegistry.instance = null;
  return ModelRegistry.getInstance(plugin);
}

describe("generateChatResponse", () => {
  let registry: ModelRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
  });

  it("calls streamText with the correct model", async () => {
    const request: ChatRequest = {
      requestID: "test-1",
      modelId: "openai:gpt-4o",
      messages: [{ role: "user", content: "Hello" }],
    };
    await generateChatResponse(request, registry);
    expect(streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: request.messages,
        system: expect.stringContaining("helpful assistant"),
      }),
    );
  });

  it("includes system prompt when provided", async () => {
    const request: ChatRequest = {
      requestID: "test-2",
      modelId: "openai:gpt-4o",
      messages: [{ role: "user", content: "Hello" }],
      systemPrompt: "You are a pirate.",
    };
    await generateChatResponse(request, registry);
    expect(streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining("You are a pirate."),
      }),
    );
  });

  it("appends web search instructions when webSearch is true", async () => {
    const request: ChatRequest = {
      requestID: "test-3",
      modelId: "openai:gpt-4o",
      messages: [{ role: "user", content: "Latest news" }],
      webSearch: true,
    };
    await generateChatResponse(request, registry);
    expect(streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining("search the web"),
      }),
    );
  });

  it("appends context to system prompt when provided", async () => {
    const request: ChatRequest = {
      requestID: "test-4",
      modelId: "openai:gpt-4o",
      messages: [{ role: "user", content: "Hello" }],
      context: [{ title: "Note A", content: "Important info" }],
    };
    await generateChatResponse(request, registry);
    expect(streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining("Important info"),
      }),
    );
  });

  it("disables web search for models that don't support it", async () => {
    // o1 has toggleWebSearch: false
    const request: ChatRequest = {
      requestID: "test-5",
      modelId: "openai:o1",
      messages: [{ role: "user", content: "Hello" }],
      webSearch: true,
    };
    await generateChatResponse(request, registry);
    expect(streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.not.stringContaining("search the web"),
      }),
    );
  });
});

describe("cancelChatResponse", () => {
  let registry: ModelRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
  });

  it("cancels an active request", async () => {
    const request: ChatRequest = {
      requestID: "cancel-test",
      modelId: "openai:gpt-4o",
      messages: [{ role: "user", content: "Hello" }],
    };
    await generateChatResponse(request, registry);
    // Should not throw
    cancelChatResponse(request);
  });

  it("does nothing for unknown request ID", () => {
    const request: ChatRequest = {
      requestID: "nonexistent",
      modelId: "openai:gpt-4o",
      messages: [],
    };
    // Should not throw
    cancelChatResponse(request);
  });
});

describe("generateChatTitle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset singleton
    // @ts-expect-error accessing private static for test reset
    ModelRegistry.instance = null;
  });

  it("generates a title from messages", async () => {
    const plugin = createMockPlugin({ renamingModel: "openai:gpt-4o" as ModelId });
    ModelRegistry.getInstance(plugin);

    const messages = [
      { role: "user" as const, content: "Tell me about quantum physics" },
      {
        role: "assistant" as const,
        content: "Quantum physics is the study of matter at the atomic level.",
      },
    ];
    const title = await generateChatTitle(messages, plugin);
    expect(title).toBe("Chat summary title (Chat)");
    expect(generateText).toHaveBeenCalled();
  });

  it("returns empty string when no renaming model configured", async () => {
    const plugin = createMockPlugin({ renamingModel: "" });
    const title = await generateChatTitle([], plugin);
    expect(title).toBe("");
    expect(generateText).not.toHaveBeenCalled();
  });

  it("strips disallowed filename characters from title", async () => {
    vi.mocked(generateText).mockResolvedValueOnce({
      text: "Title/with\\bad:chars",
    } as never);

    const plugin = createMockPlugin({ renamingModel: "openai:gpt-4o" as ModelId });
    ModelRegistry.getInstance(plugin);

    const messages = [{ role: "user" as const, content: "Hello" }];
    const title = await generateChatTitle(messages, plugin);
    expect(title).not.toContain("/");
    expect(title).not.toContain("\\");
    expect(title).not.toContain(":");
  });

  it("truncates long titles to 50 characters plus suffix", async () => {
    vi.mocked(generateText).mockResolvedValueOnce({
      text: "A".repeat(100),
    } as never);

    const plugin = createMockPlugin({ renamingModel: "openai:gpt-4o" as ModelId });
    ModelRegistry.getInstance(plugin);

    const messages = [{ role: "user" as const, content: "Hello" }];
    const title = await generateChatTitle(messages, plugin);
    // Title is truncated to 50 chars + " (Chat)" suffix
    expect(title.length).toBeLessThanOrEqual(57);
  });

  it("returns empty string on generation error", async () => {
    vi.mocked(generateText).mockRejectedValueOnce(new Error("API error"));

    const plugin = createMockPlugin({ renamingModel: "openai:gpt-4o" as ModelId });
    ModelRegistry.getInstance(plugin);

    const messages = [{ role: "user" as const, content: "Hello" }];
    const title = await generateChatTitle(messages, plugin);
    expect(title).toBe("");
  });
});
