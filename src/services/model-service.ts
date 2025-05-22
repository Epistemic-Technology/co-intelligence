import {
  streamText,
  generateText,
  GenerateTextResult,
  CoreMessage,
  StreamTextResult,
  ToolSet,
} from "ai";
import { ModelRegistry } from "./model-registry";
import { ModelId, ContextItems, ChatRequest } from "@/types";
import { hexToArrayBuffer } from "obsidian";
import CoIntelligencePlugin from "@/CoIntelligencePlugin";

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

  let systemPrompt = request.systemPrompt || "";

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

  const config = {
    model,
    messages: request.messages,
    ...(systemPrompt && { system: systemPrompt }),
    ...(model.provider?.includes("anthropic") && {
      headers: {
        "anthropic-dangerous-direct-browser-access": "true",
      },
    }),
  };

  const result = streamText(config);
  return result;
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
