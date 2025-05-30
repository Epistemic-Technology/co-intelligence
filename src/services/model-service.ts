import {
  streamText,
  generateText,
  GenerateTextResult,
  CoreMessage,
  StreamTextResult,
  StreamTextOnErrorCallback,
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

  const errorHandler: StreamTextOnErrorCallback = (event: {
    error: unknown;
  }) => {
    console.error(
      `Error generating chat response: ${(event.error as Error).message}`,
    );
    throw event.error as Error;
  };

  const defaultConfig: StreamConfig = {
    messages: request.messages,
    model: model,
    abortSignal: abortController.signal,
    system: systemPrompt,
    onError: errorHandler,
  };

  const streamTextProps: StreamTextFromProviderProps = {
    request,
    registry,
    defaultConfig,
  };
  const providerPrefix = model.provider.split(".")[0];

  let finalConfig: StreamConfig;

  switch (providerPrefix) {
    case "anthropic":
      finalConfig = anthropicConfig(streamTextProps);
      break;
    case "openai":
      finalConfig = openAIConfig(streamTextProps);
      break;
    case "google":
      finalConfig = googleConfig(streamTextProps);
      break;
    default:
      finalConfig = defaultConfig;
  }

  try {
    const result = streamText(finalConfig);
    return result;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

interface StreamConfig {
  messages: CoreMessage[];
  model: LanguageModelV1;
  abortSignal: AbortSignal;
  system: string;
  onError: StreamTextOnErrorCallback;
  tools?: any;
}

interface StreamTextFromProviderProps {
  request: ChatRequest;
  registry: ModelRegistry;
  defaultConfig: StreamConfig;
}

const openAIConfig = ({
  request,
  defaultConfig,
}: StreamTextFromProviderProps) => {
  const config = { ...defaultConfig };

  if (request.webSearch) {
    config.tools.web_search_preview = openai.tools.webSearchPreview();
  }

  return config;
};

const anthropicConfig = ({ defaultConfig }: StreamTextFromProviderProps) => {
  const config = {
    ...defaultConfig,
    headers: {
      "anthropic-dangerous-direct-browser-access": "true",
    },
  };

  return config;
};

const googleConfig = ({
  request,
  defaultConfig,
}: StreamTextFromProviderProps) => {
  const model = defaultConfig.model;
  if (request.webSearch) {
    (model as any).settings.useSearchGrounding = true;
  }
  const config = {
    ...defaultConfig,
    model: model,
  };

  return config;
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
