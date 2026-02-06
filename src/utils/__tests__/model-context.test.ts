import { describe, it, expect, vi, beforeEach } from "vitest";
import { App, TFile, requestUrl } from "obsidian";
import { getContext, makeContext, contextTokenEstimate } from "@/utils/model-context";
import { ContextItems, ContextItemContent } from "@/types";

function createMockApp(): App {
  return new App();
}

function createMockFile(props?: Partial<TFile>): TFile {
  const file = new TFile();
  if (props) {
    Object.assign(file, props);
  }
  return file;
}

// --- makeContext ---

describe("makeContext", () => {
  it("returns empty string for empty array", () => {
    expect(makeContext([])).toBe("");
  });

  it("formats a single context item", () => {
    const items: ContextItemContent[] = [
      { title: "Note A", content: "Content of note A" },
    ];
    const result = makeContext(items);
    expect(result).toBe("--- Note: Note A ---\nContent of note A\n---");
  });

  it("formats multiple context items separated by double newlines", () => {
    const items: ContextItemContent[] = [
      { title: "Note A", content: "Content A" },
      { title: "Note B", content: "Content B" },
    ];
    const result = makeContext(items);
    expect(result).toContain("--- Note: Note A ---");
    expect(result).toContain("Content A");
    expect(result).toContain("--- Note: Note B ---");
    expect(result).toContain("Content B");
    expect(result).toContain("\n\n");
  });

  it("preserves newlines within content", () => {
    const items: ContextItemContent[] = [
      { title: "Note", content: "Line 1\nLine 2\nLine 3" },
    ];
    const result = makeContext(items);
    expect(result).toContain("Line 1\nLine 2\nLine 3");
  });
});

// --- getContext ---

describe("getContext", () => {
  let app: App;

  beforeEach(() => {
    app = createMockApp();
    vi.mocked(requestUrl).mockReset();
  });

  it("returns empty array for null items", async () => {
    const result = await getContext(null, app);
    expect(result).toEqual([]);
  });

  it("returns empty array for empty items", async () => {
    const items: ContextItems = { notes: [], tags: [], sources: [] };
    const result = await getContext(items, app);
    expect(result).toEqual([]);
  });

  it("fetches content from linked notes", async () => {
    const file = createMockFile({ name: "research.md", path: "research.md" });
    vi.mocked(app.vault.cachedRead).mockResolvedValue("Note content here");

    const items: ContextItems = { notes: [file], tags: [], sources: [] };
    const result = await getContext(items, app);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("research.md");
    expect(result[0].content).toBe("Note content here");
    expect(app.vault.cachedRead).toHaveBeenCalledWith(file);
  });

  it("fetches content from tagged notes", async () => {
    const file = createMockFile({ name: "tagged.md", path: "tagged.md" });
    vi.mocked(app.vault.getMarkdownFiles).mockReturnValue([file]);
    vi.mocked(app.metadataCache.getCache).mockReturnValue({
      tags: [{ tag: "#research", position: {} }],
    });
    vi.mocked(app.vault.cachedRead).mockResolvedValue("Tagged note content");

    const items: ContextItems = {
      notes: [],
      tags: ["#research"],
      sources: [],
    };
    const result = await getContext(items, app);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("tagged.md");
    expect(result[0].content).toBe("Tagged note content");
  });

  it("fetches content from web sources", async () => {
    vi.mocked(requestUrl).mockResolvedValue({
      text: "<p>Web content</p>",
      json: {},
    } as never);

    const items: ContextItems = {
      notes: [],
      tags: [],
      sources: [{ url: "https://example.com", title: "Example" }],
    };
    const result = await getContext(items, app);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Example");
    // htmlToMarkdown in mock returns the input as-is
    expect(result[0].content).toBe("<p>Web content</p>");
    expect(requestUrl).toHaveBeenCalledWith({ url: "https://example.com" });
  });

  it("uses URL as title fallback for web sources", async () => {
    vi.mocked(requestUrl).mockResolvedValue({
      text: "<p>Content</p>",
      json: {},
    } as never);

    const items: ContextItems = {
      notes: [],
      tags: [],
      sources: [{ url: "https://example.com" }],
    };
    const result = await getContext(items, app);
    expect(result[0].title).toBe("https://example.com");
  });

  it("combines notes, tags, and sources", async () => {
    const noteFile = createMockFile({
      name: "direct.md",
      path: "direct.md",
    });
    const taggedFile = createMockFile({
      name: "tagged.md",
      path: "tagged.md",
    });

    vi.mocked(app.vault.getMarkdownFiles).mockReturnValue([taggedFile]);
    vi.mocked(app.metadataCache.getCache).mockReturnValue({
      tags: [{ tag: "#test", position: {} }],
    });
    vi.mocked(app.vault.cachedRead).mockImplementation(async (file: TFile) => {
      if (file.name === "direct.md") return "Direct content";
      if (file.name === "tagged.md") return "Tagged content";
      return "";
    });
    vi.mocked(requestUrl).mockResolvedValue({
      text: "Web content",
      json: {},
    } as never);

    const items: ContextItems = {
      notes: [noteFile],
      tags: ["#test"],
      sources: [{ url: "https://example.com", title: "Web" }],
    };
    const result = await getContext(items, app);

    expect(result).toHaveLength(3);
    expect(result[0].title).toBe("direct.md");
    expect(result[1].title).toBe("tagged.md");
    expect(result[2].title).toBe("Web");
  });
});

// --- contextTokenEstimate ---

describe("contextTokenEstimate", () => {
  let app: App;

  beforeEach(() => {
    app = createMockApp();
  });

  it("returns 0 for empty context", async () => {
    const items: ContextItems = { notes: [], tags: [], sources: [] };
    const result = await contextTokenEstimate(items, app);
    expect(result).toBe(0);
  });

  it("estimates tokens as content length / 4", async () => {
    const file = createMockFile({ name: "note.md", path: "note.md" });
    // 40 characters -> 10 tokens
    vi.mocked(app.vault.cachedRead).mockResolvedValue(
      "a".repeat(40),
    );
    const items: ContextItems = { notes: [file], tags: [], sources: [] };
    const result = await contextTokenEstimate(items, app);
    expect(result).toBe(10);
  });

  it("sums token estimates across multiple items", async () => {
    const file1 = createMockFile({ name: "a.md", path: "a.md" });
    const file2 = createMockFile({ name: "b.md", path: "b.md" });
    vi.mocked(app.vault.cachedRead).mockImplementation(async (file: TFile) => {
      if (file.name === "a.md") return "a".repeat(100); // 25 tokens
      if (file.name === "b.md") return "b".repeat(200); // 50 tokens
      return "";
    });
    const items: ContextItems = { notes: [file1, file2], tags: [], sources: [] };
    const result = await contextTokenEstimate(items, app);
    expect(result).toBe(75);
  });
});
