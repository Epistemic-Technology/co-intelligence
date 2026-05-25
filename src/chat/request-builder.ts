import {
    ChatRequest,
    ContextItemContent,
    Model,
    ModelChatMessage,
} from "@/types";

export interface BuildChatRequestParams {
    model: Model;
    messages: ModelChatMessage[];
    context?: ContextItemContent[];
    webSearch?: boolean;
    systemPrompt?: string;
}

/**
 * Assembles a {@link ChatRequest} from its inputs. Snapshots the messages array
 * so later mutations by the caller don't leak into the in-flight request.
 */
export function buildChatRequest(params: BuildChatRequestParams): ChatRequest {
    return {
        requestID: crypto.randomUUID(),
        modelId: params.model.id,
        messages: [...params.messages],
        context: params.context,
        webSearch: params.webSearch,
        systemPrompt: params.systemPrompt,
    };
}
