import {
  streamText,
  generateText,
  GenerateTextResult,
  CoreMessage,
  StreamTextResult,
  ToolSet,
  LanguageModelV1,
} from "ai";
import { openai } from "@ai-sdk/openai";

import { ModelRegistry } from "./model-registry";
import { ModelId, ContextItems, ChatRequest } from "@/types";
import { hexToArrayBuffer } from "obsidian";
import CoIntelligencePlugin from "@/CoIntelligencePlugin";

const abortControllers = new Map<string, AbortController>();

/**
 * Generates a chat response based on the provided request.
 *
 * @param request The chat request containing model ID, messages, and optional system prompt
 * @param stream Whether to stream the response or not
 * @returns For stream=true: a Promise of StreamTextResult object with streaming capabilities
 *          For stream=false: a Promise of GenerateTextResult object with the complete response
 */
export async function generateChatResponse(
  request: ChatRequest,
  registry: ModelRegistry,
): Promise<StreamTextResult<ToolSet, never>> {
  const model = registry.getLanguageModel(request.modelId);

  const abortController = new AbortController();
  abortControllers.set(request.requestID, abortController);

  let systemPrompt = request.systemPrompt || "You are a helpful assistant.";

  if (request.context && request.context.length > 0) {
    const notesContext = request.context
      .map((note) => `--- Note: ${note.title} ---\n${note.content}\n---`)
      .join("\n\n");

    const contextPreamble =
      "The following documents provide additional context for answering the user's question:\n\n";

    if (systemPrompt) {
      systemPrompt += "\n\n" + contextPreamble + notesContext;
    } else {
      systemPrompt = contextPreamble + notesContext;
    }
  }

  switch (model.provider) {
    case "anthropic.messages":
      return streamTextAnthropic(
        request,
        registry,
        systemPrompt,
        abortController.signal,
      );
    case "openai.chat":
      return streamTextOpenAI(
        request,
        registry,
        systemPrompt,
        abortController.signal,
      );
    case "google.generative-ai":
      return streamTextGoogle(
        request,
        registry,
        systemPrompt,
        abortController.signal,
      );
    default:
      return streamTextDefault(
        request,
        registry,
        systemPrompt,
        abortController.signal,
      );
  }
}

interface StreamTextFromProvider {
  (
    request: ChatRequest,
    registry: ModelRegistry,
    systemPrompt: string,
    abortSignal: AbortSignal,
  ): Promise<StreamTextResult<ToolSet, never>>;
}

const streamTextDefault: StreamTextFromProvider = async (
  request,
  registry,
  systemPrompt,
  abortSignal,
) => {
  const model = registry.getLanguageModel(request.modelId);
  const config = {
    messages: request.messages,
    model: model,
    abortSignal: abortSignal,
    system: systemPrompt,
  };
  try {
    const result = streamText(config);
    return result;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const streamTextOpenAI: StreamTextFromProvider = async (
  request,
  registry,
  systemPrompt,
  abortSignal,
) => {
  const model = registry.getLanguageModel(request.modelId, request.webSearch);
  console.log("Web search enabled?", request.webSearch);
  const config = {
    messages: request.messages,
    model: model,
    abortSignal: abortSignal,
    system: systemPrompt,
    tools: {},
  } as any;

  if (request.webSearch) {
    config.tools.web_search_preview = openai.tools.webSearchPreview();
  }
  try {
    const result = streamText(config);
    return result;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const streamTextAnthropic: StreamTextFromProvider = async (
  request,
  registry,
  systemPrompt,
  abortSignal,
) => {
  const model = registry.getLanguageModel(request.modelId);
  const config = {
    messages: request.messages,
    model: model,
    abortSignal: abortSignal,
    system: systemPrompt,
    headers: {
      "anthropic-dangerous-direct-browser-access": "true",
    },
    tools: {},
  };

  try {
    const result = streamText(config);
    return result;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const streamTextGoogle: StreamTextFromProvider = async (
  request,
  registry,
  systemPrompt,
  abortSignal,
) => {
  const model = registry.getLanguageModel(request.modelId);
  if (request.webSearch) {
    (model as any).settings.useSearchGrounding = true;
  }
  const config = {
    messages: request.messages,
    model: model,
    abortSignal: abortSignal,
    system: systemPrompt,
  };
  try {
    const result = streamText(config);
    return result;
  } catch (error) {
    console.error(error);
    throw error;
  }
};
export function cancelChatResponse(request: ChatRequest) {
  const abortController = abortControllers.get(request.requestID);
  if (abortController) {
    abortController.abort();
    abortControllers.delete(request.requestID);
  }
}

export function deleteAbortControllerForRequest(request: ChatRequest) {
  const abortController = abortControllers.get(request.requestID);
  if (abortController) {
    abortControllers.delete(request.requestID);
  }
}

export async function generateChatTitle(
  messages: CoreMessage[],
  plugin: CoIntelligencePlugin,
): Promise<string> {
  const renamingModel = plugin.settings.renamingModel;
  if (!renamingModel) {
    return "";
  }
  const registry = ModelRegistry.getInstance(plugin);
  const model = registry.getLanguageModel(renamingModel);
  const params = {
    model,
    messages: messages,
    system:
      "Summarize this conversation into a short title of six words or less. Use the normal rules for sentence capitalization rather than title case. There should not be a period at the end of the summary. The title must not contain the characters /, \\, or :",
    ...(model.provider?.includes("anthropic") && {
      headers: {
        "anthropic-dangerous-direct-browser-access": "true",
      },
    }),
  };
  try {
    const summary = (await generateText(params)).text.replaceAll(
      /[/\\:]/g,
      "-",
    );
    return `${summary} (Chat)`;
  } catch (error) {
    console.error("Error generating chat title:", error);
    return "";
  }
}
