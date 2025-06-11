/**
 * Debounces a function by delaying its execution until the specified delay
 * has elapsed since the last time it was invoked.
 *
 * @param func The function to debounce
 * @param wait The number of milliseconds to delay
 * @returns A debounced version of the function
 */
export function debounce<TArgs extends readonly unknown[]>(
  func: (...args: TArgs) => Promise<void>,
  wait: number,
): (...args: TArgs) => void {
  let timeout: number | null = null;

  return function (...args: TArgs): void {
    const later = async () => {
      timeout = null;
      await func(...args);
    };

    if (timeout !== null) {
      window.clearTimeout(timeout);
    }

    timeout = window.setTimeout(later, wait);
  };
}
