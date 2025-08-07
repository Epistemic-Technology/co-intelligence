# Testing Implementation Plan for Co-Intelligence AI

## Executive Summary

This document outlines a comprehensive testing strategy for the Co-Intelligence AI Obsidian plugin. The plugin presents unique testing challenges due to its architecture: a Solid.js UI framework, integration with Obsidian's API, AI SDK streaming capabilities, and the constraint that Obsidian plugins must compile to a single `main.js` file.

Our approach uses Vitest as the primary testing framework (leveraging existing Vite configuration), the AI SDK's built-in testing utilities for mocking AI responses, and minimal Obsidian API mocks to enable unit and integration testing without requiring a full Obsidian environment.

## Technology Stack

### Core Testing Framework
- **Vitest** - Primary test runner (chosen over Jest for seamless Vite integration)
- **@vitest/ui** - Interactive UI for exploring test results
- **@vitest/coverage-v8** - Code coverage reporting
- **jsdom** - DOM environment for testing Solid.js components

### Solid.js Testing
- **@solidjs/testing-library** - Solid-specific testing utilities
- **@testing-library/user-event** - Realistic user interaction simulation

### AI SDK Testing
- **Built-in test utilities from 'ai/test'**:
  - `MockLanguageModelV2` - Mock language model
  - `simulateReadableStream` - Stream simulation with realistic delays
  - No additional mocking libraries needed for AI responses

### Existing Dependencies (Already in project)
- **typescript** - Type checking
- **vite** - Build tool
- **solid-js** - UI framework

## Project Setup

### Step 1: Install Testing Dependencies

```bash
npm install -D vitest @vitest/ui @vitest/coverage-v8 jsdom @solidjs/testing-library @testing-library/user-event
```

### Step 2: Configure Vitest

Create `vitest.config.ts` in the project root:

```typescript
import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import solid from 'vite-plugin-solid';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [solid()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@assets': path.resolve(__dirname, './assets'),
        'obsidian': path.resolve(__dirname, './test/mocks/obsidian.ts')
      }
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./test/setup.ts'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        exclude: [
          'node_modules/',
          'test/',
          '**/*.d.ts',
          '**/*.config.*',
          '**/dist/**'
        ]
      }
    }
  };
});
```

### Step 3: Update package.json Scripts

```json
{
  "scripts": {
    "dev": "vite build --watch",
    "build": "vite build",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage"
  }
}
```

### Step 4: Create Test Infrastructure

```
test/
├── setup.ts                 # Global test setup and configuration
├── mocks/
│   ├── obsidian.ts         # Minimal Obsidian API mocks
│   └── solid-context.tsx   # Mock providers for Solid.js components
├── fixtures/
│   ├── chat-data.ts        # Sample chat messages and threads
│   ├── ai-responses.ts     # Predefined AI response patterns
│   └── notes.ts            # Sample Obsidian notes
└── utils/
    ├── test-helpers.ts     # Common test utilities
    └── render.tsx          # Custom render with providers
```

## Testing Architecture

### Test Categories

#### 1. Unit Tests (Priority: High)
- **Location**: `src/**/__tests__/*.test.ts`
- **Targets**: Pure functions, utilities, business logic
- **Examples**: 
  - URL validation in `utils/url.ts`
  - Debounce logic in `utils/debounce.ts`
  - Note serialization in `utils/notes.ts`

#### 2. Service Tests (Priority: High)
- **Location**: `src/services/__tests__/*.test.ts`
- **Targets**: Core services with mocked dependencies
- **Examples**:
  - Model registry singleton behavior
  - AI streaming responses with abort handling
  - Context preparation for prompts

#### 3. Component Tests (Priority: Medium)
- **Location**: `src/components/__tests__/*.test.tsx`
- **Targets**: Solid.js components with mocked contexts
- **Examples**:
  - User input handling and keyboard shortcuts
  - Message rendering and interactions
  - Model selector behavior

#### 4. Integration Tests (Priority: Low)
- **Location**: `test/integration/*.test.ts`
- **Targets**: Multi-component workflows
- **Examples**:
  - Complete chat creation flow
  - Settings persistence
  - View switching

### Mocking Strategy

#### Obsidian API Mocks

Create minimal mocks that only implement the methods actually used:

```typescript
// test/mocks/obsidian.ts
export class TFile {
  path: string;
  basename: string;
  extension: string;
  
  constructor(path: string) {
    this.path = path;
    this.basename = path.split('/').pop()?.replace(/\.[^/.]+$/, '') || '';
    this.extension = path.split('.').pop() || '';
  }
}

export class Plugin {
  app: App;
  manifest: any;
  
  constructor(app: App, manifest: any) {
    this.app = app;
    this.manifest = manifest;
  }
  
  addCommand() { return this; }
  addSettingTab() { return this; }
  registerView() { return this; }
  saveData() { return Promise.resolve(); }
  loadData() { return Promise.resolve({}); }
}

export class App {
  vault = {
    create: jest.fn(),
    modify: jest.fn(),
    read: jest.fn(),
    getMarkdownFiles: jest.fn(() => []),
  };
  
  workspace = {
    getLeaf: jest.fn(),
    activeLeaf: null,
  };
  
  metadataCache = {
    getFileCache: jest.fn(),
  };
}
```

#### AI SDK Mock Patterns

```typescript
// test/fixtures/ai-responses.ts
import { MockLanguageModelV2, simulateReadableStream } from 'ai/test';

export const createMockModel = (response: string) => {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          { type: 'text-delta', textDelta: response },
          { type: 'finish', finishReason: 'stop' }
        ]
      })
    })
  });
};

export const createMockStreamingModel = (chunks: string[]) => {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          ...chunks.map(chunk => ({ type: 'text-delta', textDelta: chunk })),
          { type: 'finish', finishReason: 'stop' }
        ]
      })
    })
  });
};
```

## Implementation Phases

### Phase 1: Foundation (Week 1)
1. **Day 1-2**: Set up Vitest configuration and test infrastructure
2. **Day 3-4**: Create minimal Obsidian mocks
3. **Day 5**: Write first utility function tests (debounce, url validation)
4. **Day 6-7**: Establish testing patterns and documentation

**Deliverables**: 
- Working test environment
- 5-10 utility function tests
- Testing guidelines document

### Phase 2: Core Services (Week 2)
1. **Day 1-2**: Test `model-registry.ts`
   - Singleton pattern
   - Provider initialization
   - Model availability checks
2. **Day 3-4**: Test `model-service.ts`
   - Stream handling with AI SDK mocks
   - Abort controller behavior
   - Context injection
3. **Day 5-7**: Test note utilities
   - COI note creation
   - Serialization/deserialization
   - Markdown parsing

**Deliverables**:
- 90%+ coverage for services
- Documentation of service testing patterns

### Phase 3: Component Testing (Week 3)
1. **Day 1-2**: Set up Solid.js testing utilities
2. **Day 3-4**: Test simple components (buttons, icons)
3. **Day 5-7**: Test complex components
   - ChatInterface
   - UserInput
   - ModelSelector

**Deliverables**:
- Component test suite
- Custom render utilities
- Interaction testing examples

### Phase 4: Integration & Polish (Week 4)
1. **Day 1-2**: Plugin lifecycle tests
2. **Day 3-4**: Chat workflow integration tests
3. **Day 5-6**: CI/CD setup
4. **Day 7**: Documentation and cleanup

**Deliverables**:
- Integration test suite
- GitHub Actions workflow
- Final documentation

## Code Examples

### Example 1: Testing the Model Service

```typescript
// src/services/__tests__/model-service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockLanguageModelV2, simulateReadableStream } from 'ai/test';
import { generateChatResponse } from '@/services/model-service';
import { ModelRegistry } from '@/services/model-registry';

describe('model-service', () => {
  let mockRegistry: ModelRegistry;
  
  beforeEach(() => {
    mockRegistry = {
      getLanguageModel: vi.fn(),
      getModel: vi.fn(() => ({ toggleWebSearch: true }))
    } as any;
  });

  it('should stream a chat response', async () => {
    const mockModel = new MockLanguageModelV2({
      doStream: async () => ({
        stream: simulateReadableStream({
          chunks: [
            { type: 'text-delta', textDelta: 'Hello' },
            { type: 'text-delta', textDelta: ' world' },
            { type: 'finish', finishReason: 'stop', usage: { 
              promptTokens: 10, 
              completionTokens: 2, 
              totalTokens: 12 
            }}
          ]
        })
      })
    });
    
    mockRegistry.getLanguageModel.mockReturnValue(mockModel);
    
    const request = {
      modelId: 'test-model',
      messages: [{ role: 'user', content: 'Hi' }],
      requestID: 'test-123',
      webSearch: false
    };
    
    const result = await generateChatResponse(request, mockRegistry);
    
    // Collect the streamed text
    let fullText = '';
    for await (const part of result.textStream) {
      fullText += part;
    }
    
    expect(fullText).toBe('Hello world');
    expect(mockRegistry.getLanguageModel).toHaveBeenCalledWith('test-model');
  });

  it('should handle abort signals', async () => {
    // Test abort controller functionality
  });

  it('should inject context into system prompt', async () => {
    // Test context preparation
  });
});
```

### Example 2: Testing a Solid.js Component

```typescript
// src/components/__tests__/UserInput.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { UserInput } from '@/components/UserInput';

describe('UserInput', () => {
  const defaultProps = {
    onSendMessage: vi.fn(),
    isLoading: false,
    onStopGenerating: vi.fn()
  };

  it('should send message on Enter key', async () => {
    const user = userEvent.setup();
    render(() => <UserInput {...defaultProps} />);
    
    const input = screen.getByPlaceholderText('Type your message...');
    await user.type(input, 'Test message{Enter}');
    
    expect(defaultProps.onSendMessage).toHaveBeenCalledWith('Test message');
    expect(input).toHaveValue('');
  });

  it('should not send empty messages', async () => {
    const user = userEvent.setup();
    render(() => <UserInput {...defaultProps} />);
    
    const input = screen.getByPlaceholderText('Type your message...');
    await user.type(input, '{Enter}');
    
    expect(defaultProps.onSendMessage).not.toHaveBeenCalled();
  });

  it('should show stop button when loading', () => {
    render(() => <UserInput {...defaultProps} isLoading={true} />);
    
    const stopButton = screen.getByLabelText('Stop generating');
    expect(stopButton).toBeInTheDocument();
  });
});
```

### Example 3: Testing Note Utilities

```typescript
// src/utils/__tests__/notes.test.ts
import { describe, it, expect } from 'vitest';
import { createCOINote, deserializeChatThread } from '@/utils/notes';
import { TFile } from 'obsidian';

describe('notes utilities', () => {
  describe('createCOINote', () => {
    it('should create a valid COI note structure', () => {
      const note = createCOINote('Test Chat', [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' }
      ]);
      
      expect(note).toContain('---');
      expect(note).toContain('is-coi-chat: true');
      expect(note).toContain('# Test Chat');
      expect(note).toContain('<!-- CHAT-THREAD-START -->');
      expect(note).toContain('<!-- CHAT-THREAD-END -->');
    });
  });

  describe('deserializeChatThread', () => {
    it('should parse messages from note content', () => {
      const content = `
---
is-coi-chat: true
---
# Chat
<!-- CHAT-THREAD-START -->
[{"role":"user","content":"Hello"},{"role":"assistant","content":"Hi!"}]
<!-- CHAT-THREAD-END -->
      `;
      
      const messages = deserializeChatThread(content);
      
      expect(messages).toHaveLength(2);
      expect(messages[0]).toEqual({ role: 'user', content: 'Hello' });
      expect(messages[1]).toEqual({ role: 'assistant', content: 'Hi!' });
    });
  });
});
```

## CI/CD Integration

### GitHub Actions Workflow

Create `.github/workflows/test.yml`:

```yaml
name: Tests

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run tests
      run: npm run test:coverage
    
    - name: Upload coverage reports
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/coverage-final.json
```

## Best Practices

### General Testing Guidelines

1. **Test Behavior, Not Implementation**
   - Focus on public APIs and user-facing behavior
   - Avoid testing internal implementation details

2. **Keep Tests Fast**
   - Mock external dependencies (Obsidian API, AI providers)
   - Use in-memory operations instead of file I/O

3. **Write Descriptive Test Names**
   ```typescript
   // Good
   it('should display error message when model API key is missing')
   
   // Bad
   it('test error')
   ```

4. **Follow AAA Pattern**
   - **Arrange**: Set up test data and dependencies
   - **Act**: Execute the code under test
   - **Assert**: Verify the results

### Obsidian Plugin-Specific Considerations

1. **Mock Minimally**
   - Only mock the Obsidian APIs your code actually uses
   - Keep mocks simple and focused

2. **Handle Async Operations**
   - Most Obsidian APIs are async
   - Use `async/await` in tests consistently

3. **Test File Operations Carefully**
   ```typescript
   // Mock file operations instead of actual I/O
   vault.create = vi.fn().mockResolvedValue(new TFile('test.md'));
   ```

4. **Settings Management**
   - Use in-memory settings for tests
   - Reset settings between tests

### AI SDK Testing Patterns

1. **Test Different Response Scenarios**
   - Successful completion
   - Partial responses
   - Error handling
   - Abort/cancellation

2. **Simulate Realistic Streaming**
   ```typescript
   simulateReadableStream({
     chunks: [...],
     chunkDelayInMs: 50 // Simulate typing delay
   })
   ```

3. **Test Context Handling**
   - Empty context
   - Large context
   - Special characters in context

## Common Pitfalls and Solutions

### Pitfall 1: Over-Mocking
**Problem**: Creating elaborate mocks that mirror entire Obsidian API
**Solution**: Mock only what you use, add mocks as needed

### Pitfall 2: Testing Framework Code
**Problem**: Testing Solid.js reactivity or Obsidian's internal behavior
**Solution**: Focus on your business logic and user interactions

### Pitfall 3: Slow Tests
**Problem**: Tests that perform real file I/O or network requests
**Solution**: Use mocks and in-memory operations

### Pitfall 4: Brittle Tests
**Problem**: Tests that break with minor implementation changes
**Solution**: Test public APIs and user-facing behavior

## Troubleshooting

### Vitest + Solid.js Issues

1. **Component not rendering**
   - Ensure `@solidjs/testing-library` is properly configured
   - Check that jsdom environment is set

2. **Reactivity not working in tests**
   - Wrap state changes in `act()` if needed
   - Use `waitFor` for async updates

### Obsidian Mock Issues

1. **Missing API methods**
   - Add methods to mocks as you discover them
   - Keep a shared mock file updated

2. **Type errors**
   - Use TypeScript's `Partial` types for mocks
   - Cast to `any` when necessary (document why)

### AI SDK Test Issues

1. **Stream not completing**
   - Ensure you include a finish chunk
   - Check for proper error handling

2. **Timing issues**
   - Use `waitFor` for async assertions
   - Adjust chunk delays if needed

## Conclusion

This testing implementation plan provides a pragmatic approach to testing the Co-Intelligence AI Obsidian plugin. By leveraging Vitest's integration with Vite, the AI SDK's built-in testing utilities, and minimal Obsidian mocks, we can achieve good test coverage without the complexity of full end-to-end testing.

Remember: Start small, focus on high-value tests, and progressively improve coverage as the codebase evolves. The goal is not 100% coverage but confidence that critical functionality works correctly.