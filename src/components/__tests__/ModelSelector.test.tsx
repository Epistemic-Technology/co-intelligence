import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { createSignal } from 'solid-js';
import { ModelSelector } from '@/components/ModelSelector';
import { Model, ModelId } from '@/types';
import { render, createMockPlugin } from '../../../test/utils/render';

// Mock ModelRegistry
vi.mock('@/services/model-registry', () => ({
  ModelRegistry: {
    getInstance: vi.fn(),
  }
}));

// Mock LucideIcon component
vi.mock('@/components/LucideIcon', () => ({
  LucideIcon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`}></span>
}));

describe('ModelSelector', () => {
  const mockModels: Model[] = [
    {
      id: 'openai:gpt-4' as ModelId,
      provider: 'openai',
      name: 'GPT-4',
      renaming: false,
      toggleWebSearch: true,
      streaming: true,
    },
    {
      id: 'anthropic:claude-3-5-sonnet' as ModelId,
      provider: 'anthropic', 
      name: 'Claude 3.5 Sonnet',
      renaming: false,
      toggleWebSearch: false,
      streaming: true,
    }
  ];

  let mockRegistry: any;

  beforeEach(async () => {
    mockRegistry = {
      availableModels: [],
      getModel: vi.fn(),
    };

    const { ModelRegistry } = await import('@/services/model-registry');
    vi.mocked(ModelRegistry.getInstance).mockReturnValue(mockRegistry);
  });

  it('should render with no models available', () => {
    mockRegistry.availableModels = [];
    const [selectedModel, setSelectedModel] = createSignal<Model | null>(null);
    const onModelChange = vi.fn();

    render(() => 
      <ModelSelector 
        selectedModel={selectedModel}
        onModelChange={onModelChange}
      />,
      { plugin: createMockPlugin() }
    );
    
    expect(screen.getByRole('combobox')).toBeDisabled();
    expect(screen.getByText('No available models')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-label', 'No models available');
  });

  it('should render available models', () => {
    mockRegistry.availableModels = mockModels;
    const [selectedModel, setSelectedModel] = createSignal<Model | null>(null);
    const onModelChange = vi.fn();

    render(() => 
      <ModelSelector 
        selectedModel={selectedModel}
        onModelChange={onModelChange}
      />,
      { plugin: createMockPlugin() }
    );
    
    expect(screen.getByRole('combobox')).not.toBeDisabled();
    expect(screen.getByText('GPT-4')).toBeInTheDocument();
    expect(screen.getByText('Claude 3.5 Sonnet')).toBeInTheDocument();
  });

  it('should call onModelChange when selection changes', async () => {
    mockRegistry.availableModels = mockModels;
    mockRegistry.getModel.mockImplementation((id: ModelId) => 
      mockModels.find(model => model.id === id) || null
    );
    
    const user = userEvent.setup();
    const [selectedModel, setSelectedModel] = createSignal<Model | null>(null);
    const onModelChange = vi.fn();

    render(() => 
      <ModelSelector 
        selectedModel={selectedModel}
        onModelChange={onModelChange}
      />,
      { plugin: createMockPlugin() }
    );
    
    const select = screen.getByRole('combobox');
    await user.selectOptions(select, 'openai:gpt-4');
    
    expect(mockRegistry.getModel).toHaveBeenCalledWith('openai:gpt-4');
    expect(onModelChange).toHaveBeenCalledWith(mockModels[0]);
  });

  it('should display selected model', () => {
    mockRegistry.availableModels = mockModels;
    const [selectedModel, setSelectedModel] = createSignal<Model | null>(mockModels[0]);
    const onModelChange = vi.fn();

    render(() => 
      <ModelSelector 
        selectedModel={selectedModel}
        onModelChange={onModelChange}
      />,
      { plugin: createMockPlugin() }
    );
    
    expect(screen.getByRole('combobox')).toHaveValue('openai:gpt-4');
  });

  it('should show label when showLabel is true', () => {
    mockRegistry.availableModels = [];
    const [selectedModel, setSelectedModel] = createSignal<Model | null>(null);
    const onModelChange = vi.fn();

    render(() => 
      <ModelSelector 
        selectedModel={selectedModel}
        onModelChange={onModelChange}
        label="Choose Model"
        showLabel={true}
      />,
      { plugin: createMockPlugin() }
    );
    
    expect(screen.getByText('Choose Model')).toBeInTheDocument();
    expect(screen.getByText('Choose Model')).toHaveClass('model-selector-label');
  });

  it('should hide label when showLabel is false', () => {
    mockRegistry.availableModels = [];
    const [selectedModel, setSelectedModel] = createSignal<Model | null>(null);
    const onModelChange = vi.fn();

    render(() => 
      <ModelSelector 
        selectedModel={selectedModel}
        onModelChange={onModelChange}
        label="Choose Model"
        showLabel={false}
      />,
      { plugin: createMockPlugin() }
    );
    
    // The label should exist but be visually hidden with sr-only class
    const hiddenLabel = document.querySelector('label.sr-only');
    expect(hiddenLabel).toBeInTheDocument();
    expect(hiddenLabel).toHaveClass('sr-only');
    expect(hiddenLabel).toHaveTextContent('Choose Model');
  });

  it('should render bot icon', () => {
    mockRegistry.availableModels = [];
    const [selectedModel, setSelectedModel] = createSignal<Model | null>(null);
    const onModelChange = vi.fn();

    render(() => 
      <ModelSelector 
        selectedModel={selectedModel}
        onModelChange={onModelChange}
      />,
      { plugin: createMockPlugin() }
    );
    
    expect(screen.getByTestId('icon-bot-message-square')).toBeInTheDocument();
  });
});