import { vi } from 'vitest';

// Common test utilities

export const mockFn = <T extends (...args: any[]) => any>() => vi.fn<Parameters<T>, ReturnType<T>>();

export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const createMockFile = (path: string) => ({
  path,
  basename: path.split('/').pop()?.replace(/\.[^/.]+$/, '') || '',
  extension: path.split('.').pop() || '',
  name: path.split('/').pop() || '',
});