import { vi, afterEach, expect } from "vitest";
import '@testing-library/jest-dom';

// Global test setup and configuration
global.console = {
  ...console,
  // Suppress console.log in tests unless needed for debugging
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: console.error, // Keep error logging for debugging
};

// Add Obsidian extensions to built-in types
declare global {
  interface String {
    contains(searchString: string): boolean;
  }
}

// Polyfill for Obsidian's String.contains method
String.prototype.contains = function (searchString: string): boolean {
  return this.includes(searchString);
};

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
  vi.clearAllTimers();
  vi.useRealTimers();
});
