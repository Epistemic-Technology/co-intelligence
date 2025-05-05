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
