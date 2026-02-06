import { describe, it, expect } from "vitest";
import { getDomainFromUrl, ensureSourceTitle } from "@/utils/url";

describe("getDomainFromUrl", () => {
  it("extracts domain from a standard https URL", () => {
    expect(getDomainFromUrl("https://example.com/path")).toBe("example.com");
  });

  it("extracts domain from http URL", () => {
    expect(getDomainFromUrl("http://example.com")).toBe("example.com");
  });

  it("extracts domain with subdomain", () => {
    expect(getDomainFromUrl("https://www.example.com/page")).toBe(
      "www.example.com",
    );
  });

  it("extracts domain without port (hostname only)", () => {
    expect(getDomainFromUrl("https://example.com:8080/path")).toBe(
      "example.com",
    );
  });

  it("extracts domain from URL with query params", () => {
    expect(getDomainFromUrl("https://example.com/path?q=1&b=2")).toBe(
      "example.com",
    );
  });

  it("falls back to regex for malformed URLs", () => {
    expect(getDomainFromUrl("not-a-url.com/path")).toBe("not-a-url.com");
  });

  it("falls back to regex for URLs without protocol (strips www.)", () => {
    expect(getDomainFromUrl("www.example.com/page")).toBe("example.com");
  });

  it("returns original string for completely invalid input", () => {
    expect(getDomainFromUrl("")).toBe("");
  });
});

describe("ensureSourceTitle", () => {
  it("returns existing title when present", () => {
    const result = ensureSourceTitle({
      url: "https://example.com",
      title: "My Title",
    });
    expect(result.title).toBe("My Title");
    expect(result.url).toBe("https://example.com");
  });

  it("trims whitespace from existing title", () => {
    const result = ensureSourceTitle({
      url: "https://example.com",
      title: "  My Title  ",
    });
    expect(result.title).toBe("My Title");
  });

  it("uses domain as fallback when title is missing", () => {
    const result = ensureSourceTitle({ url: "https://example.com/page" });
    expect(result.title).toBe("example.com");
  });

  it("uses domain as fallback when title is empty string", () => {
    const result = ensureSourceTitle({
      url: "https://example.com",
      title: "",
    });
    expect(result.title).toBe("example.com");
  });

  it("uses domain as fallback when title is whitespace", () => {
    const result = ensureSourceTitle({
      url: "https://example.com",
      title: "   ",
    });
    expect(result.title).toBe("example.com");
  });

  it("does not mutate the original source object", () => {
    const original = { url: "https://example.com", title: "Original" };
    const result = ensureSourceTitle(original);
    expect(result).not.toBe(original);
    expect(original.title).toBe("Original");
  });
});
