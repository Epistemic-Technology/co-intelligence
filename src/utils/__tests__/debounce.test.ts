import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debounce } from '../debounce';

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should delay function execution', async () => {
    const mockFn = vi.fn().mockResolvedValue(undefined);
    const debouncedFn = debounce(mockFn, 100);

    debouncedFn('test');
    expect(mockFn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(mockFn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    await vi.runAllTimersAsync();
    expect(mockFn).toHaveBeenCalledWith('test');
  });

  it('should cancel previous execution when called multiple times', async () => {
    const mockFn = vi.fn().mockResolvedValue(undefined);
    const debouncedFn = debounce(mockFn, 100);

    debouncedFn('first');
    vi.advanceTimersByTime(50);
    debouncedFn('second');
    vi.advanceTimersByTime(50);
    debouncedFn('third');

    vi.advanceTimersByTime(100);
    await vi.runAllTimersAsync();

    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith('third');
  });

  it('should handle multiple arguments', async () => {
    const mockFn = vi.fn().mockResolvedValue(undefined);
    const debouncedFn = debounce(mockFn, 100);

    debouncedFn('arg1', 'arg2', 'arg3');

    vi.advanceTimersByTime(100);
    await vi.runAllTimersAsync();

    expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2', 'arg3');
  });

  it('should handle async function execution', async () => {
    const mockFn = vi.fn().mockImplementation(async (value: string) => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return value.toUpperCase();
    });
    const debouncedFn = debounce(mockFn, 100);

    debouncedFn('test');
    vi.advanceTimersByTime(100);
    await vi.runAllTimersAsync();

    expect(mockFn).toHaveBeenCalledWith('test');
  });
});