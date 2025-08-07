import { render as solidRender } from '@solidjs/testing-library';
import { JSX, createContext } from 'solid-js';
import { App } from 'obsidian';
import { vi } from 'vitest';

// Mock contexts that components might need
export const MockAppContext = createContext<App>();
export const MockPluginContext = createContext<any>();

// Mock App instance for testing
export const createMockApp = (): App => ({
  vault: {
    create: vi.fn(),
    modify: vi.fn(), 
    read: vi.fn(),
    getMarkdownFiles: vi.fn(() => []),
  },
  workspace: {
    getLeaf: vi.fn(),
    activeLeaf: null,
  },
  metadataCache: {
    getFileCache: vi.fn(),
  },
} as any);

// Mock Plugin instance for testing
export const createMockPlugin = () => ({
  app: createMockApp(),
  manifest: {},
  addCommand: vi.fn(),
  addSettingTab: vi.fn(),
  registerView: vi.fn(),
  saveData: vi.fn(() => Promise.resolve()),
  loadData: vi.fn(() => Promise.resolve({})),
});

// Custom render function with providers
export const render = (
  component: () => JSX.Element,
  options?: {
    app?: App;
    plugin?: any;
  }
) => {
  const mockApp = options?.app || createMockApp();
  const mockPlugin = options?.plugin || createMockPlugin();
  
  const WrappedComponent = () => (
    <MockAppContext.Provider value={mockApp}>
      <MockPluginContext.Provider value={mockPlugin}>
        {component()}
      </MockPluginContext.Provider>
    </MockAppContext.Provider>
  );

  return solidRender(WrappedComponent);
};