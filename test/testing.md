# Testing Guide for Co-Intelligence AI

This document provides instructions for running tests and understanding the testing infrastructure for the Co-Intelligence AI Obsidian plugin.

## Quick Start

```bash
# Run all tests
npm test

# Run tests in watch mode (interactive)
npm test

# Run tests once and exit
npm run test:run

# Run tests with coverage report
npm run test:coverage

# Open interactive test UI in browser
npm run test:ui
```

## Testing Commands

### Basic Testing
- `npm test` - Run tests in watch mode (recommended for development)
- `npm run test:run` - Run all tests once and exit (used in CI)

### Coverage & Analysis
- `npm run test:coverage` - Generate detailed coverage report (HTML + terminal)
- `npm run test:ui` - Open Vitest UI for interactive test exploration

### Development Tips
- Use `npm test` during development - it watches for file changes and re-runs tests automatically
- Use `npm run test:ui` for debugging complex test scenarios with the visual interface
- Check `coverage/index.html` after running coverage command for detailed HTML report

## Directory Structure

```
test/
├── testing.md              # This guide
├── setup.ts                # Global test setup and configuration
├── mocks/                  # Mock implementations
│   └── obsidian.ts         # Obsidian API mocks
├── fixtures/               # Test data (planned)
│   ├── chat-data.ts        # Sample chat messages
│   ├── ai-responses.ts     # Mock AI responses
│   └── notes.ts            # Sample Obsidian notes
└── utils/                  # Test utilities
    ├── test-helpers.ts     # Common helper functions
    └── render.tsx          # Custom Solid.js render utilities

src/
├── **/__tests__/           # Unit tests (co-located with source)
│   ├── *.test.ts          # TypeScript/utility tests
│   └── *.test.tsx         # Component tests
└── ...
```

## Testing Approach

### 1. Unit Tests (Current Focus)
**Location**: `src/**/__tests__/*.test.ts`
**Purpose**: Test individual functions and utilities in isolation

Examples:
- `src/utils/__tests__/debounce.test.ts` - Debounce function logic
- `src/utils/__tests__/url.test.ts` - URL parsing and validation
- `src/utils/__tests__/notes.test.ts` - Note serialization/deserialization

### 2. Service Tests (Phase 2)
**Location**: `src/services/__tests__/*.test.ts`
**Purpose**: Test core business logic with mocked dependencies

Planned tests:
- Model registry behavior
- AI streaming with abort handling  
- Context preparation for prompts

### 3. Component Tests (Phase 3)
**Location**: `src/components/__tests__/*.test.tsx`
**Purpose**: Test Solid.js components with user interactions

Planned tests:
- User input handling
- Message rendering
- Model selector behavior

## Mock Strategy

### Obsidian API Mocks
We use minimal mocks in `test/mocks/obsidian.ts` that only implement methods actually used by our code:

```typescript
// Example: Mock only what you need
export class App {
  vault = {
    create: vi.fn().mockResolvedValue(new TFile('test.md')),
    read: vi.fn().mockResolvedValue(''),
    // ... only mocked methods we use
  };
}
```

### AI SDK Testing
The AI SDK provides built-in testing utilities:
```typescript
import { MockLanguageModelV2, simulateReadableStream } from 'ai/test';
```

### Obsidian Extensions
We polyfill Obsidian-specific extensions in `test/setup.ts`:
```typescript
// Adds String.contains() method used by Obsidian
String.prototype.contains = function(searchString: string): boolean {
  return this.includes(searchString);
};
```

## Writing Tests

### Basic Test Structure
```typescript
import { describe, it, expect, vi } from 'vitest';
import { functionToTest } from '../source-file';

describe('functionToTest', () => {
  it('should do something specific', () => {
    const result = functionToTest('input');
    expect(result).toBe('expected');
  });
});
```

### Testing Async Functions
```typescript
it('should handle async operations', async () => {
  const result = await asyncFunction();
  expect(result).toBeDefined();
});
```

### Mocking Dependencies
```typescript
import { vi } from 'vitest';

const mockFn = vi.fn().mockReturnValue('mocked result');
const mockAsync = vi.fn().mockResolvedValue('async result');
```

### Testing Solid.js Components (Phase 3)
```typescript
import { render, screen } from '@solidjs/testing-library';
import { MyComponent } from '../MyComponent';

it('should render correctly', () => {
  render(() => <MyComponent prop="value" />);
  expect(screen.getByText('Expected Text')).toBeInTheDocument();
});
```

## Configuration Files

### vitest.config.ts
Main test configuration with:
- Solid.js plugin integration
- Path aliases matching main Vite config
- Obsidian mock aliasing
- Coverage settings
- jsdom environment for DOM testing

### test/setup.ts
Global test setup that runs before all tests:
- Console suppression for cleaner test output
- Obsidian API extensions (String.contains, etc.)
- Mock cleanup between tests

## Coverage Goals

### Current Coverage (Phase 1)
- ✅ **debounce.ts**: 100% coverage
- ✅ **url.ts**: 100% coverage  
- ✅ **notes.ts**: 46% coverage (core functions tested)

### Target Coverage (Future Phases)
- **Services**: 90%+ coverage
- **Components**: 70%+ coverage  
- **Overall**: 60%+ coverage

Coverage reports help identify untested code paths and ensure quality.

## Best Practices

### DO:
- ✅ Test behavior, not implementation details
- ✅ Use descriptive test names: `should handle empty input gracefully`
- ✅ Mock external dependencies (Obsidian API, network calls)
- ✅ Test edge cases and error conditions
- ✅ Keep tests fast and independent

### DON'T:
- ❌ Test framework internals (Solid.js reactivity, Obsidian's behavior)
- ❌ Create elaborate mocks that mirror entire APIs
- ❌ Write slow tests with real file I/O or network requests
- ❌ Make tests depend on each other's state

## Troubleshooting

### Common Issues

#### Tests Not Finding Obsidian Imports
**Solution**: Check that `vitest.config.ts` has the obsidian alias:
```typescript
resolve: {
  alias: {
    'obsidian': path.resolve(__dirname, './test/mocks/obsidian.ts')
  }
}
```

#### Solid.js Components Not Rendering
**Solution**: Ensure jsdom environment is configured:
```typescript
test: {
  environment: 'jsdom'
}
```

#### Missing Mock Methods
**Solution**: Add methods to `test/mocks/obsidian.ts` as you discover them:
```typescript
// Add missing methods as needed
someObsidianClass = {
  newMethod: vi.fn().mockReturnValue('default'),
  // ...
}
```

#### String.contains() Not Found
This is handled in `test/setup.ts` but if you see this error, ensure setup files are properly configured in `vitest.config.ts`.

## Future Phases

### Phase 2: Core Services Testing
- Model registry singleton behavior
- AI streaming with real response simulation
- Context injection and preparation
- Error handling and abort scenarios

### Phase 3: Component Testing  
- User interaction simulation
- State management testing
- Integration between components
- Accessibility testing

### Phase 4: Integration & E2E
- Complete workflow testing
- Plugin lifecycle testing
- Settings persistence testing
- CI/CD pipeline integration

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Solid.js Testing Library](https://github.com/solidjs/solid-testing-library)  
- [AI SDK Testing Guide](https://sdk.vercel.ai/docs)
- [Testing Implementation Plan](../testing-implementation.md) - Full implementation strategy

---

For questions or issues with testing, refer to the main implementation plan or create an issue in the repository.