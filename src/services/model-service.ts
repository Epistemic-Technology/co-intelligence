import { streamText, generateText, GenerateTextResult, CoreMessage } from "ai";
import { ModelRegistry, ModelId } from "./model-registry";

/**
 * Interface for chat request parameters.
 */
export interface ChatRequest {
  modelId: ModelId; // e.g., 'openai:gpt-4-turbo'
  messages: CoreMessage[];
  systemPrompt?: string;
}

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
): Promise<AsyncIterable<string>> {
  const model = registry.getLanguageModel(request.modelId);

  const config = {
    model,
    messages: request.messages,
    ...(request.systemPrompt && { system: request.systemPrompt }),
  };

  const result = streamText(config);
  return result.textStream;
}

export async function generateChatTitle(
  modelId: ModelId,
  messages: CoreMessage[],
  registry: ModelRegistry,
): Promise<string> {
  const model = registry.getLanguageModel(modelId);
  const params = {
    model,
    messages: messages,
    system:
      "Summarize this conversation into a short title of six words or less. Use the normal rules for sentence capitalization rather than title case. There should not be a period at the end of the summary. The title must not contain the characters /, \\, or :",
  };
  const summary = (await generateText(params)).text.replaceAll(/[/\\:]/g, "-");
  return `${summary} (Chat)`;
}
