# Component Testing Guide

This guide provides patterns and best practices for testing Solid.js components in the Co-Intelligence AI plugin.

## Overview

Component testing in this project uses:
- **@solidjs/testing-library** - Solid-specific testing utilities
- **@testing-library/user-event** - User interaction simulation
- **Custom render function** - Provides necessary contexts and mocks

## Testing Patterns

### 1. Simple Components

For components with minimal dependencies and straightforward behavior:

```typescript
// Example: ProcessingIndicator.test.tsx
import { render } from '../../../test/utils/render';

describe('ProcessingIndicator', () => {
  it('should render processing indicator with text', () => {
    render(() => <ProcessingIndicator />);
    
    expect(screen.getByText('Generating response...')).toBeInTheDocument();
  });
});
```

### 2. Components with Obsidian Dependencies

For components that use Obsidian APIs (like `setIcon`):

```typescript
// Mock Obsidian functions
const mockSetIcon = vi.fn();
vi.mock('obsidian', async () => {
  const actual = await vi.importActual('obsidian');
  return {
    ...actual,
    setIcon: mockSetIcon,
  };
});

describe('LucideIcon', () => {
  it('should call setIcon with correct parameters', async () => {
    render(() => <LucideIcon name="home" />);
    
    await new Promise(resolve => setTimeout(resolve, 0)); // Wait for onMount
    
    expect(mockSetIcon).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      'home'
    );
  });
});
```

### 3. Components with Context Dependencies

For components that use context (App, Plugin):

```typescript
import { render, createMockPlugin, createMockApp } from '../../../test/utils/render';

describe('ModelSelector', () => {
  it('should render with plugin context', () => {
    render(() => 
      <ModelSelector {...props} />,
      { 
        plugin: createMockPlugin(),
        app: createMockApp()
      }
    );
  });
});
```

### 4. Complex Components with Services

For components that interact with services:

```typescript
// Mock the service
const mockModelRegistry = {
  availableModels: [],
  getInstance: vi.fn(),
};

vi.mock('@/services/model-registry', () => ({
  ModelRegistry: mockModelRegistry
}));

describe('UserInput', () => {
  beforeEach(() => {
    mockModelRegistry.getInstance.mockReturnValue(mockModelRegistry);
  });
});
```

### 5. Testing User Interactions

Use `@testing-library/user-event` for realistic interactions:

```typescript
import userEvent from '@testing-library/user-event';

it('should submit on Enter key', async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();
  
  render(() => <UserInput onSubmit={onSubmit} {...otherProps} />);
  
  const textarea = screen.getByRole('textbox');
  await user.type(textarea, 'Test message{Enter}');
  
  expect(onSubmit).toHaveBeenCalledWith('Test message', false, '');
});
```

### 6. Testing Reactive State

For components with Solid.js signals:

```typescript
import { createSignal } from 'solid-js';

it('should display selected model', () => {
  const [selectedModel, setSelectedModel] = createSignal(mockModel);
  
  render(() => 
    <ModelSelector 
      selectedModel={selectedModel}
      onModelChange={vi.fn()}
    />
  );
  
  expect(screen.getByRole('combobox')).toHaveValue('openai:gpt-4');
});
```

## Mock Strategies

### 1. Service Mocking

Always mock external services to isolate component behavior:

```typescript
vi.mock('@/services/model-registry', () => ({
  ModelRegistry: {
    getInstance: () => mockRegistry,
  }
}));
```

### 2. Child Component Mocking

Mock complex child components to focus on the component under test:

```typescript
vi.mock('@/components/ModelSelector', () => ({
  ModelSelector: ({ onModelChange }: any) => (
    <select data-testid="model-selector" onChange={() => onModelChange(null)}>
      <option>Mock Model</option>
    </select>
  )
}));
```

### 3. Obsidian API Mocking

Mock only the Obsidian APIs your component actually uses:

```typescript
class MockNoteLinkSuggestionModal {
  constructor(public app: any, public query: string, public onSelect: Function) {}
  open() { this.onSelect(new TFile('/test.md')); }
  onClose = vi.fn();
}

vi.mock('@/components/NoteLinkSuggestionModal', () => ({
  NoteLinkSuggestionModal: MockNoteLinkSuggestionModal
}));
```

## Best Practices

### 1. Test User-Facing Behavior

Focus on what users see and interact with, not implementation details:

```typescript
// Good - tests user-facing behavior
expect(screen.getByRole('button')).toBeInTheDocument();

// Bad - tests implementation details
expect(wrapper.find('.internal-class')).toExist();
```

### 2. Use Meaningful Test Names

Test names should describe the expected behavior:

```typescript
// Good
it('should disable textarea when no models are available')

// Bad
it('should work correctly')
```

### 3. Arrange-Act-Assert Pattern

Structure tests clearly:

```typescript
it('should toggle web search checkbox', async () => {
  // Arrange
  const user = userEvent.setup();
  render(() => <UserInput {...mockProps} />);
  
  // Act
  const checkbox = screen.getByRole('checkbox');
  await user.click(checkbox);
  
  // Assert
  expect(checkbox).toBeChecked();
});
```

### 4. Clean Up Between Tests

Use `beforeEach` to reset mocks and state:

```typescript
beforeEach(() => {
  mockService.method.mockClear();
  mockService.availableItems = [];
});
```

### 5. Test Error Conditions

Don't forget to test error states and edge cases:

```typescript
it('should throw error when plugin context is not available', () => {
  expect(() => 
    render(() => <Component />),
    { plugin: null }
  ).toThrow('Plugin Context is not available');
});
```

### 6. Use Accessibility-Friendly Queries

Prefer queries that match how users interact with your app:

```typescript
// Good - uses semantic role
screen.getByRole('textbox')
screen.getByRole('button', { name: 'Submit' })

// Good - uses label text
screen.getByLabelText('Model selector')

// Okay - uses visible text
screen.getByText('Cancel')

// Avoid - uses test IDs (only when necessary)
screen.getByTestId('complex-component')
```

## Common Pitfalls

### 1. Over-Mocking
Don't mock everything - focus on external dependencies and complex children.

### 2. Testing Implementation Details
Test what users see, not how the code works internally.

### 3. Ignoring Async Operations
Always await user interactions and effects:

```typescript
await user.click(button);
await waitFor(() => expect(screen.getByText('Success')).toBeInTheDocument());
```

### 4. Not Cleaning Up
Reset mocks and clear state between tests to avoid test interdependence.

### 5. Overly Complex Tests
Keep tests focused on one behavior at a time. Split complex scenarios into multiple tests.

## File Organization

```
src/components/
├── ComponentName.tsx
└── __tests__/
    └── ComponentName.test.tsx
```

Each component should have its test file in a `__tests__` directory within the same folder as the component.

## Running Tests

```bash
# Run all component tests
npm run test src/components

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

## Examples

See the following test files for complete examples:
- `src/components/__tests__/ProcessingIndicator.test.tsx` - Simple component
- `src/components/__tests__/LucideIcon.test.tsx` - Component with Obsidian dependency
- `src/components/__tests__/ModelSelector.test.tsx` - Component with service dependency
- `src/components/__tests__/UserInput.test.tsx` - Complex component with multiple interactions
- `src/components/__tests__/ChatInterface.test.tsx` - Integration-style component test