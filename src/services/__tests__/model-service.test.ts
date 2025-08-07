import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  generateChatResponse, 
  cancelChatResponse, 
  deleteAbortControllerForRequest,
  generateChatTitle 
} from '@/services/model-service';
import { ModelRegistry } from '@/services/model-registry';
import { ChatRequest, ModelChatMessage, ContextItemContent } from '@/types';
import type { CoIntelligencePlugin } from '@/CoIntelligencePlugin';

// Mock the AI SDK
vi.mock('ai', async () => {
  const actual = await vi.importActual('ai');
  return {
    ...actual,
    streamText: vi.fn(),
    generateText: vi.fn()
  };
});

// Mock the openai SDK
vi.mock('@ai-sdk/openai', () => ({
  openai: {
    tools: {
      webSearchPreview: vi.fn(() => ({ type: 'web_search_preview' }))
    }
  }
}));

// Mock the model context utility
vi.mock('@/utils/model-context', () => ({
  makeContext: vi.fn((contexts: ContextItemContent[]) => 
    contexts.map(c => `--- Note: ${c.title} ---\n${c.content}\n---`).join('\n\n')
  )
}));

// Mock ModelRegistry to avoid singleton instance issues in tests
let mockRegistryInstance: any;
vi.mock('@/services/model-registry', () => ({
  ModelRegistry: {
    getInstance: vi.fn(() => mockRegistryInstance)
  }
}));

import { streamText, generateText } from 'ai';

describe('model-service', () => {
  let mockRegistry: ModelRegistry;
  let mockPlugin: CoIntelligencePlugin;
  let mockModel: any;
  let baseRequest: ChatRequest;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Create mock model
    mockModel = {
      provider: 'openai',
      doStream: vi.fn().mockResolvedValue({
        stream: async function* () {
          yield { type: 'text-delta', textDelta: 'Hello' };
          yield { type: 'text-delta', textDelta: ' world' };
          yield { type: 'finish', finishReason: 'stop', usage: { 
            promptTokens: 10, 
            completionTokens: 2, 
            totalTokens: 12 
          }};
        }
      })
    };

    // Create mock registry
    mockRegistry = {
      getLanguageModel: vi.fn().mockReturnValue(mockModel),
      getModel: vi.fn().mockReturnValue({
        id: 'openai:gpt-4o',
        provider: 'openai',
        name: 'OpenAI GPT-4o',
        renaming: true,
        toggleWebSearch: true,
        streaming: true
      })
    } as any;

    // Set the mock registry instance for the mocked ModelRegistry.getInstance
    mockRegistryInstance = mockRegistry;

    // Create mock plugin
    mockPlugin = {
      settings: {
        renamingModel: 'openai:gpt-4o'
      }
    } as any;

    // Base request object
    baseRequest = {
      requestID: 'test-request-123',
      modelId: 'openai:gpt-4o' as any,
      messages: [{ role: 'user', content: 'Hello' }],
      webSearch: false
    };

    // Mock streamText to return a mock result
    const mockStreamResult = {
      textStream: (async function* () {
        yield 'Hello';
        yield ' world';
      })(),
      text: 'Hello world',
      finishReason: 'stop',
      usage: { promptTokens: 10, completionTokens: 2, totalTokens: 12 }
    };
    
    (streamText as any).mockResolvedValue(mockStreamResult);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('generateChatResponse', () => {
    it('should generate a basic chat response', async () => {
      const result = await generateChatResponse(baseRequest, mockRegistry);
      
      expect(mockRegistry.getLanguageModel).toHaveBeenCalledWith('openai:gpt-4o');
      expect(mockRegistry.getModel).toHaveBeenCalledWith('openai:gpt-4o');
      expect(streamText).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should use default system prompt when none provided', async () => {
      await generateChatResponse(baseRequest, mockRegistry);
      
      const streamTextCall = (streamText as any).mock.calls[0][0];
      expect(streamTextCall.system).toBe('You are a helpful assistant.');
    });

    it('should use custom system prompt when provided', async () => {
      const requestWithSystem = {
        ...baseRequest,
        systemPrompt: 'You are a helpful coding assistant.'
      };
      
      await generateChatResponse(requestWithSystem, mockRegistry);
      
      const streamTextCall = (streamText as any).mock.calls[0][0];
      expect(streamTextCall.system).toBe('You are a helpful coding assistant.');
    });

    it('should disable web search for models that do not support it', async () => {
      mockRegistry.getModel = vi.fn().mockReturnValue({
        id: 'openai:o1',
        provider: 'openai',
        name: 'OpenAI O1',
        renaming: false,
        toggleWebSearch: false,
        streaming: true
      });

      const requestWithWebSearch = {
        ...baseRequest,
        modelId: 'openai:o1' as any,
        webSearch: true
      };
      
      await generateChatResponse(requestWithWebSearch, mockRegistry);
      
      // The webSearch should be set to false internally
      expect(requestWithWebSearch.webSearch).toBe(false);
    });

    it('should add web search system prompt when web search enabled', async () => {
      const requestWithWebSearch = {
        ...baseRequest,
        webSearch: true,
        systemPrompt: 'Custom prompt.'
      };
      
      await generateChatResponse(requestWithWebSearch, mockRegistry);
      
      const streamTextCall = (streamText as any).mock.calls[0][0];
      expect(streamTextCall.system).toContain('Custom prompt.');
      expect(streamTextCall.system).toContain('You should search the web for current information');
    });

    it('should add OpenAI web search tool when web search enabled for OpenAI models', async () => {
      const requestWithWebSearch = {
        ...baseRequest,
        webSearch: true
      };
      
      await generateChatResponse(requestWithWebSearch, mockRegistry);
      
      const streamTextCall = (streamText as any).mock.calls[0][0];
      expect(streamTextCall.tools).toBeDefined();
      expect(streamTextCall.tools.web_search_preview).toEqual({ type: 'web_search_preview' });
    });

    it('should add reasoning summary for O3 models', async () => {
      const o3Request = {
        ...baseRequest,
        modelId: 'openai:o3' as any
      };
      
      await generateChatResponse(o3Request, mockRegistry);
      
      const streamTextCall = (streamText as any).mock.calls[0][0];
      expect(streamTextCall.providerOptions?.openai?.reasoningSummary).toBe('detailed');
    });

    it('should add anthropic headers for anthropic models', async () => {
      const anthropicModel = {
        provider: 'anthropic'
      };

      mockRegistry.getLanguageModel = vi.fn().mockReturnValue(anthropicModel);
      mockRegistry.getModel = vi.fn().mockReturnValue({
        id: 'anthropic:claude-4-sonnet-20250514',
        provider: 'anthropic',
        name: 'Anthropic Claude 4 Sonnet',
        renaming: true,
        toggleWebSearch: false,
        streaming: true
      });

      const anthropicRequest = {
        ...baseRequest,
        modelId: 'anthropic:claude-4-sonnet-20250514' as any
      };
      
      await generateChatResponse(anthropicRequest, mockRegistry);
      
      const streamTextCall = (streamText as any).mock.calls[0][0];
      expect(streamTextCall.headers).toEqual({
        'anthropic-dangerous-direct-browser-access': 'true'
      });
    });

    it('should configure Google models for web search', async () => {
      const mockGoogleModel = {
        provider: 'google',
        settings: {} as any
      };

      mockRegistry.getLanguageModel = vi.fn().mockReturnValue(mockGoogleModel);
      mockRegistry.getModel = vi.fn().mockReturnValue({
        id: 'google:gemini-2.0-flash',
        provider: 'google',
        name: 'Google Gemini 2.0 Flash',
        renaming: false,
        toggleWebSearch: true,
        streaming: true
      });

      const googleRequest = {
        ...baseRequest,
        modelId: 'google:gemini-2.0-flash' as any,
        webSearch: true
      };
      
      await generateChatResponse(googleRequest, mockRegistry);
      
      expect(mockGoogleModel.settings.useSearchGrounding).toBe(true);
    });

    it('should handle context injection', async () => {
      const contextItems: ContextItemContent[] = [
        { title: 'Note 1', content: 'Content of note 1' },
        { title: 'Note 2', content: 'Content of note 2' }
      ];

      const requestWithContext = {
        ...baseRequest,
        context: contextItems,
        systemPrompt: 'Base prompt.'
      };
      
      await generateChatResponse(requestWithContext, mockRegistry);
      
      const streamTextCall = (streamText as any).mock.calls[0][0];
      expect(streamTextCall.system).toContain('Base prompt.');
      expect(streamTextCall.system).toContain('The following documents provide additional context');
      expect(streamTextCall.system).toContain('--- Note: Note 1 ---');
      expect(streamTextCall.system).toContain('Content of note 1');
    });

    it('should handle errors in streaming', async () => {
      const errorMessage = 'Streaming error';
      (streamText as any).mockRejectedValue(new Error(errorMessage));

      await expect(generateChatResponse(baseRequest, mockRegistry)).rejects.toThrow(errorMessage);
    });

    it('should create and store abort controller', async () => {
      await generateChatResponse(baseRequest, mockRegistry);
      
      const streamTextCall = (streamText as any).mock.calls[0][0];
      expect(streamTextCall.abortSignal).toBeInstanceOf(AbortSignal);
    });
  });

  describe('abort controller functionality', () => {
    it('should cancel chat response', async () => {
      // Start a request
      const responsePromise = generateChatResponse(baseRequest, mockRegistry);
      
      // Cancel it
      cancelChatResponse(baseRequest);
      
      // The abort signal should be triggered
      const streamTextCall = (streamText as any).mock.calls[0][0];
      expect(streamTextCall.abortSignal).toBeInstanceOf(AbortSignal);
      
      await responsePromise;
    });

    it('should delete abort controller for request', async () => {
      await generateChatResponse(baseRequest, mockRegistry);
      
      // Should not throw
      deleteAbortControllerForRequest(baseRequest);
    });

    it('should handle canceling non-existent request', () => {
      const nonExistentRequest = {
        ...baseRequest,
        requestID: 'non-existent-request'
      };
      
      // Should not throw
      expect(() => cancelChatResponse(nonExistentRequest)).not.toThrow();
    });

    it('should handle deleting non-existent abort controller', () => {
      const nonExistentRequest = {
        ...baseRequest,
        requestID: 'non-existent-request'
      };
      
      // Should not throw
      expect(() => deleteAbortControllerForRequest(nonExistentRequest)).not.toThrow();
    });
  });

  describe('generateChatTitle', () => {
    const testMessages: ModelChatMessage[] = [
      { role: 'user', content: 'How do I implement a binary search algorithm?' },
      { role: 'assistant', content: 'A binary search algorithm works by...' }
    ];


    it('should generate a chat title', async () => {
      const mockGenerateResult = {
        text: 'Binary Search Implementation Guide'
      };
      (generateText as any).mockResolvedValue(mockGenerateResult);

      const title = await generateChatTitle(testMessages, mockPlugin);
      
      expect(title).toBe('Binary Search Implementation Guide (Chat)');
      expect(generateText).toHaveBeenCalled();
    });

    it('should return empty string when no renaming model configured', async () => {
      mockPlugin.settings.renamingModel = "" as any;
      
      const title = await generateChatTitle(testMessages, mockPlugin);
      
      expect(title).toBe('');
      expect(generateText).not.toHaveBeenCalled();
    });

    it('should sanitize forbidden characters in title', async () => {
      const mockGenerateResult = {
        text: 'How to use / \\ and : characters'
      };
      (generateText as any).mockResolvedValue(mockGenerateResult);

      const title = await generateChatTitle(testMessages, mockPlugin);
      
      expect(title).toBe('How to use - - and - characters (Chat)');
    });

    it('should truncate long titles', async () => {
      const mockGenerateResult = {
        text: 'This is a very long title that exceeds the fifty character limit and should be truncated'
      };
      (generateText as any).mockResolvedValue(mockGenerateResult);

      const title = await generateChatTitle(testMessages, mockPlugin);
      
      expect(title.length).toBeLessThanOrEqual(57); // 50 chars + ' (Chat)' = 57
    });

    it('should handle anthropic models with special headers', async () => {
      mockRegistry.getLanguageModel = vi.fn().mockReturnValue({
        provider: 'anthropic.claude-4-sonnet-20250514'
      });

      const mockGenerateResult = {
        text: 'Anthropic Chat Title'
      };
      (generateText as any).mockResolvedValue(mockGenerateResult);

      await generateChatTitle(testMessages, mockPlugin);
      
      const generateTextCall = (generateText as any).mock.calls[0][0];
      expect(generateTextCall.headers).toEqual({
        'anthropic-dangerous-direct-browser-access': 'true'
      });
    });

    it('should handle errors gracefully', async () => {
      (generateText as any).mockRejectedValue(new Error('Title generation failed'));

      const title = await generateChatTitle(testMessages, mockPlugin);
      
      expect(title).toBe('');
    });

    it('should use correct system prompt for title generation', async () => {
      const mockGenerateResult = {
        text: 'Generated Title'
      };
      (generateText as any).mockResolvedValue(mockGenerateResult);

      await generateChatTitle(testMessages, mockPlugin);
      
      const generateTextCall = (generateText as any).mock.calls[0][0];
      expect(generateTextCall.system).toContain('Summarize the following conversation');
      expect(generateTextCall.system).toContain('six words or less');
      expect(generateTextCall.system).toContain('must not contain the characters /, \\, or :');
    });
  });
});