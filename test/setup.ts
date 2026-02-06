import "@testing-library/jest-dom/vitest";

// Obsidian adds .contains() to String.prototype. Polyfill it for tests.
if (!String.prototype.contains) {
  String.prototype.contains = function (searchString: string): boolean {
    return this.includes(searchString);
  };
}
