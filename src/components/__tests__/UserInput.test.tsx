import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { createSignal } from 'solid-js';
import { UserInput } from '@/components/UserInput';
import { Model, ModelId } from '@/types';
import { render, createMockPlugin, createMockApp } from '../../../test/utils/render';

// Mock ModelRegistry
vi.mock('@/services/model-registry', () => ({
  ModelRegistry: {
    getInstance: vi.fn(() => ({
      availableModels: [mockModel],
    })),
  }
}));

// Mock child components to isolate UserInput behavior
vi.mock('@/components/ModelSelector', () => ({
  ModelSelector: () => <div data-testid="model-selector">Model Selector</div>
}));

vi.mock('@/components/SystemPromptSelector', () => ({
  SystemPromptSelector: () => <div data-testid="system-prompt-selector">System Prompt Selector</div>
}));

vi.mock('@/components/NoteLinkSuggestionModal', () => ({
  NoteLinkSuggestionModal: class {
    constructor() {}
    open() {}
    onClose = vi.fn();
  }
}));

vi.mock('@/components/TagSuggestionModal', () => ({
  TagSuggestionModal: class {
    constructor() {}
    open() {}
    onClose = vi.fn();
  }
}));

const mockModel: Model = {
  id: 'openai:gpt-4' as ModelId,
  provider: 'openai',
  name: 'GPT-4',
  renaming: false,
  toggleWebSearch: true,
  streaming: true,
};

describe('UserInput', () => {
  let mockProps: any;

  beforeEach(() => {
    const [currentModel, setCurrentModel] = createSignal<Model | null>(mockModel);
    
    mockProps = {
      triggerChange: vi.fn(),
      onSubmit: vi.fn(),
      currentModel,
      updateModel: vi.fn(),
      onLinkNote: vi.fn(),
      onAddTag: vi.fn(),
      initialSystemPrompt: '',
    };
  });

  it('should render textarea with correct placeholder', () => {
    render(() => <UserInput {...mockProps} />, {
      app: createMockApp(),
      plugin: createMockPlugin()
    });
    
    expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('should render child components', () => {
    render(() => <UserInput {...mockProps} />, {
      app: createMockApp(),
      plugin: createMockPlugin()
    });
    
    expect(screen.getByTestId('model-selector')).toBeInTheDocument();
    expect(screen.getByTestId('system-prompt-selector')).toBeInTheDocument();
  });

  it('should submit message on Enter key', async () => {
    const user = userEvent.setup();
    
    render(() => <UserInput {...mockProps} />, {
      app: createMockApp(),
      plugin: createMockPlugin()
    });
    
    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'Test message{Enter}');
    
    expect(mockProps.onSubmit).toHaveBeenCalled();
  });

  it('should show web search checkbox when model supports it', () => {
    render(() => <UserInput {...mockProps} />, {
      app: createMockApp(),
      plugin: createMockPlugin()
    });
    
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
    expect(screen.getByText('Web search')).toBeInTheDocument();
  });

  it('should toggle web search checkbox', async () => {
    const user = userEvent.setup();
    
    render(() => <UserInput {...mockProps} />, {
      app: createMockApp(),
      plugin: createMockPlugin()
    });
    
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();
    
    await user.click(checkbox);
    expect(checkbox).toBeChecked();
  });
});