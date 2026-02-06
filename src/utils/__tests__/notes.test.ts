import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  App,
  TFile,
  TFolder,
  CachedMetadata,
} from "obsidian";
import {
  isCoiNote,
  isPathCoiNote,
  isPathActiveCoiNote,
  isActiveCoiNote,
  serializeCoiNoteContent,
  deserializeCoiNoteContent,
  sanitizeForTagName,
  getFilesWithTag,
} from "@/utils/notes";

const CHAT_START = "<!-- CHAT-THREAD-START -->";
const CHAT_END = "<!-- CHAT-THREAD-END -->";

function createMockApp(overrides?: Partial<App>): App {
  const app = new App();
  if (overrides) {
    Object.assign(app, overrides);
  }
  return app;
}

function createMockFile(props?: Partial<TFile>): TFile {
  const file = new TFile();
  if (props) {
    Object.assign(file, props);
  }
  return file;
}

// --- isCoiNote ---

describe("isCoiNote", () => {
  let app: App;

  beforeEach(() => {
    app = createMockApp();
  });

  it("returns true when note has is-coi-chat frontmatter", () => {
    const file = createMockFile({ path: "test.md" });
    vi.mocked(app.metadataCache.getFileCache).mockReturnValue({
      frontmatter: { "is-coi-chat": true },
    });
    expect(isCoiNote(file, app)).toBe(true);
  });

  it("returns false when note lacks is-coi-chat frontmatter", () => {
    const file = createMockFile({ path: "test.md" });
    vi.mocked(app.metadataCache.getFileCache).mockReturnValue({
      frontmatter: {},
    });
    expect(isCoiNote(file, app)).toBe(false);
  });

  it("returns false when metadata cache returns null", () => {
    const file = createMockFile({ path: "test.md" });
    vi.mocked(app.metadataCache.getFileCache).mockReturnValue(null);
    expect(isCoiNote(file, app)).toBe(false);
  });

  it("returns false when is-coi-chat is false", () => {
    const file = createMockFile({ path: "test.md" });
    vi.mocked(app.metadataCache.getFileCache).mockReturnValue({
      frontmatter: { "is-coi-chat": false },
    });
    expect(isCoiNote(file, app)).toBe(false);
  });
});

// --- isPathCoiNote ---

describe("isPathCoiNote", () => {
  let app: App;

  beforeEach(() => {
    app = createMockApp();
  });

  it("returns true for COI note path", () => {
    vi.mocked(app.metadataCache.getCache).mockReturnValue({
      frontmatter: { "is-coi-chat": true },
    });
    expect(isPathCoiNote("chat.md", app)).toBe(true);
  });

  it("returns false for empty path", () => {
    expect(isPathCoiNote("", app)).toBe(false);
  });

  it("returns false for non-COI note", () => {
    vi.mocked(app.metadataCache.getCache).mockReturnValue({
      frontmatter: {},
    });
    expect(isPathCoiNote("note.md", app)).toBe(false);
  });
});

// --- isPathActiveCoiNote ---

describe("isPathActiveCoiNote", () => {
  let app: App;

  beforeEach(() => {
    app = createMockApp();
  });

  it("returns true when both is-coi-chat and coi-chat-view are true", () => {
    vi.mocked(app.metadataCache.getCache).mockReturnValue({
      frontmatter: { "is-coi-chat": true, "coi-chat-view": true },
    });
    expect(isPathActiveCoiNote("chat.md", app)).toBe(true);
  });

  it("returns false when is-coi-chat is true but coi-chat-view is false", () => {
    vi.mocked(app.metadataCache.getCache).mockReturnValue({
      frontmatter: { "is-coi-chat": true, "coi-chat-view": false },
    });
    expect(isPathActiveCoiNote("chat.md", app)).toBe(false);
  });

  it("returns false for empty path", () => {
    expect(isPathActiveCoiNote("", app)).toBe(false);
  });
});

// --- isActiveCoiNote ---

describe("isActiveCoiNote", () => {
  let app: App;

  beforeEach(() => {
    app = createMockApp();
  });

  it("returns true when note has both flags set", () => {
    const file = createMockFile();
    vi.mocked(app.metadataCache.getFileCache).mockReturnValue({
      frontmatter: { "is-coi-chat": true, "coi-chat-view": true },
    });
    expect(isActiveCoiNote(file, app)).toBe(true);
  });

  it("returns false when coi-chat-view is missing", () => {
    const file = createMockFile();
    vi.mocked(app.metadataCache.getFileCache).mockReturnValue({
      frontmatter: { "is-coi-chat": true },
    });
    expect(isActiveCoiNote(file, app)).toBe(false);
  });
});

// --- sanitizeForTagName ---

describe("sanitizeForTagName", () => {
  it("converts to lowercase", () => {
    expect(sanitizeForTagName("Hello")).toBe("hello");
  });

  it("replaces special characters with hyphens", () => {
    expect(sanitizeForTagName("openai:gpt-4")).toBe("openai-gpt-4");
  });

  it("collapses multiple hyphens", () => {
    expect(sanitizeForTagName("a---b")).toBe("a-b");
  });

  it("strips leading and trailing hyphens/slashes", () => {
    expect(sanitizeForTagName("-hello-")).toBe("hello");
    expect(sanitizeForTagName("/hello/")).toBe("hello");
  });

  it("preserves forward slashes in the middle", () => {
    expect(sanitizeForTagName("foo/bar")).toBe("foo/bar");
  });

  it("preserves underscores", () => {
    expect(sanitizeForTagName("my_tag")).toBe("my_tag");
  });

  it("handles empty string", () => {
    expect(sanitizeForTagName("")).toBe("");
  });

  it("handles string with only special chars", () => {
    expect(sanitizeForTagName(":::")).toBe("");
  });

  it("trims whitespace before processing", () => {
    expect(sanitizeForTagName("  hello  ")).toBe("hello");
  });
});

// --- serializeCoiNoteContent ---

describe("serializeCoiNoteContent", () => {
  const baseContent = `---\nis-coi-chat: true\n---\n${CHAT_START}\n\n${CHAT_END}`;

  it("serializes a single user message", async () => {
    const messages = [{ role: "user" as const, content: "Hello" }];
    const result = await serializeCoiNoteContent(
      baseContent,
      createMockApp(),
      messages,
      null,
    );
    expect(result).toContain("## user:");
    expect(result).toContain("Hello");
    expect(result).toContain(CHAT_START);
    expect(result).toContain(CHAT_END);
  });

  it("serializes user and assistant messages", async () => {
    const messages = [
      { role: "user" as const, content: "Hello" },
      { role: "assistant" as const, content: "Hi there!" },
    ];
    const result = await serializeCoiNoteContent(
      baseContent,
      createMockApp(),
      messages,
      null,
    );
    expect(result).toContain("## user:");
    expect(result).toContain("Hello");
    expect(result).toContain("## assistant:");
    expect(result).toContain("Hi there!");
  });

  it("adjusts h1 headers in content by adding ##", async () => {
    const messages = [
      {
        role: "assistant" as const,
        content: "# Top heading\n\nSome text\n\n## Sub heading",
      },
    ];
    const result = await serializeCoiNoteContent(
      baseContent,
      createMockApp(),
      messages,
      null,
    );
    // h1 should become h3, h2 should become h4
    expect(result).toContain("### Top heading");
    expect(result).toContain("#### Sub heading");
  });

  it("adjusts h2 headers in content by adding #", async () => {
    const messages = [
      {
        role: "assistant" as const,
        content: "## Sub heading\n\nSome text\n\n### Deeper",
      },
    ];
    const result = await serializeCoiNoteContent(
      baseContent,
      createMockApp(),
      messages,
      null,
    );
    // h2 should become h3, h3 should become h4
    expect(result).toContain("### Sub heading");
    expect(result).toContain("#### Deeper");
  });

  it("does not adjust h3+ headers", async () => {
    const messages = [
      { role: "assistant" as const, content: "### Already deep\n\n#### Deeper" },
    ];
    const result = await serializeCoiNoteContent(
      baseContent,
      createMockApp(),
      messages,
      null,
    );
    expect(result).toContain("### Already deep");
    expect(result).toContain("#### Deeper");
  });

  it("preserves wikilinks", async () => {
    const messages = [
      { role: "user" as const, content: "See [[My Note]] for details" },
    ];
    const result = await serializeCoiNoteContent(
      baseContent,
      createMockApp(),
      messages,
      null,
    );
    expect(result).toContain("[[My Note]]");
  });

  it("serializes sources", async () => {
    const messages = [{ role: "user" as const, content: "Hello" }];
    const sources = [
      { url: "https://example.com", title: "Example" },
      { url: "https://other.com", title: "Other" },
    ];
    const result = await serializeCoiNoteContent(
      baseContent,
      createMockApp(),
      messages,
      null,
      sources,
    );
    expect(result).toContain("## Sources");
    expect(result).toContain("1. [Example](https://example.com)");
    expect(result).toContain("2. [Other](https://other.com)");
  });

  it("uses URL as source link text when title is missing", async () => {
    const messages = [{ role: "user" as const, content: "Hello" }];
    const sources = [{ url: "https://example.com" }];
    const result = await serializeCoiNoteContent(
      baseContent,
      createMockApp(),
      messages,
      null,
      sources,
    );
    expect(result).toContain("1. [https://example.com](https://example.com)");
  });

  it("preserves content before and after chat markers", async () => {
    const contentBefore = "# My Note\n\nSome intro text.\n\n";
    const contentAfter = "\n\nSome footer text.";
    const fullContent = `${contentBefore}${CHAT_START}\n\n${CHAT_END}${contentAfter}`;
    const messages = [{ role: "user" as const, content: "Hello" }];
    const result = await serializeCoiNoteContent(
      fullContent,
      createMockApp(),
      messages,
      null,
    );
    expect(result).toContain("# My Note");
    expect(result).toContain("Some intro text.");
    expect(result).toContain("Some footer text.");
  });

  it("handles empty messages array", async () => {
    const result = await serializeCoiNoteContent(
      baseContent,
      createMockApp(),
      [],
      null,
    );
    expect(result).toContain(CHAT_START);
    expect(result).toContain(CHAT_END);
  });
});

// --- deserializeCoiNoteContent ---

describe("deserializeCoiNoteContent", () => {
  it("deserializes a single user message", async () => {
    const content = `${CHAT_START}\n## user:\n\nHello world\n${CHAT_END}`;
    const result = await deserializeCoiNoteContent(content, null, createMockApp());
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].role).toBe("user");
    expect(result.messages[0].content).toBe("Hello world");
  });

  it("deserializes user and assistant messages", async () => {
    const content = `${CHAT_START}\n## user:\n\nHello\n\n## assistant:\n\nHi there!\n${CHAT_END}`;
    const result = await deserializeCoiNoteContent(content, null, createMockApp());
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0].role).toBe("user");
    expect(result.messages[0].content).toBe("Hello");
    expect(result.messages[1].role).toBe("assistant");
    expect(result.messages[1].content).toBe("Hi there!");
  });

  it("deserializes sources section", async () => {
    const content = `${CHAT_START}\n## user:\n\nQuery\n\n## Sources\n\n1. [Example](https://example.com)\n2. [Other](https://other.com)\n${CHAT_END}`;
    const result = await deserializeCoiNoteContent(content, null, createMockApp());
    expect(result.sources).toHaveLength(2);
    expect(result.sources[0]).toEqual({
      title: "Example",
      url: "https://example.com",
    });
    expect(result.sources[1]).toEqual({
      title: "Other",
      url: "https://other.com",
    });
  });

  it("returns empty arrays when no chat markers found", async () => {
    const content = "# Regular note\n\nNo chat here.";
    const result = await deserializeCoiNoteContent(content, null, createMockApp());
    expect(result.messages).toHaveLength(0);
    expect(result.sources).toHaveLength(0);
    expect(result.contextItems).toEqual({ notes: [], tags: [], sources: [] });
  });

  it("handles multiline message content", async () => {
    const content = `${CHAT_START}\n## user:\n\nLine 1\nLine 2\n\nLine 3\n${CHAT_END}`;
    const result = await deserializeCoiNoteContent(content, null, createMockApp());
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].content).toContain("Line 1");
    expect(result.messages[0].content).toContain("Line 2");
    expect(result.messages[0].content).toContain("Line 3");
  });

  it("restores linked notes from frontmatter", async () => {
    const content = `${CHAT_START}\n## user:\n\nHello\n${CHAT_END}`;
    const app = createMockApp();
    const mockFile = createMockFile({ path: "notes/linked.md" });
    vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(mockFile);

    const metadata: CachedMetadata = {
      frontmatter: {
        "linked-notes": ["notes/linked.md"],
      },
    };
    const result = await deserializeCoiNoteContent(content, metadata, app);
    expect(result.contextItems.notes).toHaveLength(1);
    expect(result.contextItems.notes[0].path).toBe("notes/linked.md");
  });

  it("restores linked tags from frontmatter", async () => {
    const content = `${CHAT_START}\n## user:\n\nHello\n${CHAT_END}`;
    const metadata: CachedMetadata = {
      frontmatter: {
        "linked-tags": ["#research", "#draft"],
      },
    };
    const result = await deserializeCoiNoteContent(
      content,
      metadata,
      createMockApp(),
    );
    expect(result.contextItems.tags).toEqual(["#research", "#draft"]);
  });

  it("handles empty chat section", async () => {
    const content = `${CHAT_START}\n${CHAT_END}`;
    const result = await deserializeCoiNoteContent(content, null, createMockApp());
    expect(result.messages).toHaveLength(0);
    expect(result.sources).toHaveLength(0);
  });

  it("ignores invalid mode headers", async () => {
    const content = `${CHAT_START}\n## unknown:\n\nShould be ignored\n\n## user:\n\nValid\n${CHAT_END}`;
    const result = await deserializeCoiNoteContent(content, null, createMockApp());
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].role).toBe("user");
    expect(result.messages[0].content).toBe("Valid");
  });
});

// --- Round-trip serialization ---

describe("serialize/deserialize round-trip", () => {
  const baseContent = `---\nis-coi-chat: true\n---\n${CHAT_START}\n\n${CHAT_END}`;

  it("preserves messages through round-trip", async () => {
    const messages = [
      { role: "user" as const, content: "What is 2+2?" },
      { role: "assistant" as const, content: "The answer is 4." },
      { role: "user" as const, content: "Thanks!" },
    ];

    const serialized = await serializeCoiNoteContent(
      baseContent,
      createMockApp(),
      messages,
      null,
    );
    const deserialized = await deserializeCoiNoteContent(
      serialized,
      null,
      createMockApp(),
    );

    expect(deserialized.messages).toHaveLength(3);
    expect(deserialized.messages[0].role).toBe("user");
    expect(deserialized.messages[0].content).toBe("What is 2+2?");
    expect(deserialized.messages[1].role).toBe("assistant");
    expect(deserialized.messages[1].content).toBe("The answer is 4.");
    expect(deserialized.messages[2].role).toBe("user");
    expect(deserialized.messages[2].content).toBe("Thanks!");
  });

  it("preserves sources through round-trip", async () => {
    const messages = [{ role: "user" as const, content: "Query" }];
    const sources = [
      { url: "https://example.com", title: "Example" },
      { url: "https://other.com", title: "Other Site" },
    ];

    const serialized = await serializeCoiNoteContent(
      baseContent,
      createMockApp(),
      messages,
      null,
      sources,
    );
    const deserialized = await deserializeCoiNoteContent(
      serialized,
      null,
      createMockApp(),
    );

    expect(deserialized.sources).toHaveLength(2);
    expect(deserialized.sources[0]).toEqual({
      title: "Example",
      url: "https://example.com",
    });
    expect(deserialized.sources[1]).toEqual({
      title: "Other Site",
      url: "https://other.com",
    });
  });

  it("preserves wikilinks through round-trip", async () => {
    const messages = [
      { role: "user" as const, content: "See [[My Note]] and [[Other Note]]" },
    ];
    const serialized = await serializeCoiNoteContent(
      baseContent,
      createMockApp(),
      messages,
      null,
    );
    const deserialized = await deserializeCoiNoteContent(
      serialized,
      null,
      createMockApp(),
    );
    expect(deserialized.messages[0].content).toContain("[[My Note]]");
    expect(deserialized.messages[0].content).toContain("[[Other Note]]");
  });
});

// --- getFilesWithTag ---

describe("getFilesWithTag", () => {
  let app: App;

  beforeEach(() => {
    app = createMockApp();
  });

  it("returns files that have the specified tag", () => {
    const file1 = createMockFile({ path: "note1.md" });
    const file2 = createMockFile({ path: "note2.md" });
    const file3 = createMockFile({ path: "note3.md" });

    vi.mocked(app.vault.getMarkdownFiles).mockReturnValue([
      file1,
      file2,
      file3,
    ]);

    vi.mocked(app.metadataCache.getCache).mockImplementation((path: string) => {
      if (path === "note1.md") {
        return { tags: [{ tag: "#research", position: {} }] };
      }
      if (path === "note2.md") {
        return { tags: [{ tag: "#draft", position: {} }] };
      }
      if (path === "note3.md") {
        return { tags: [{ tag: "#research", position: {} }] };
      }
      return null;
    });

    const result = getFilesWithTag("#research", app);
    expect(result).toHaveLength(2);
    expect(result[0].path).toBe("note1.md");
    expect(result[1].path).toBe("note3.md");
  });

  it("returns empty array when no files have the tag", () => {
    vi.mocked(app.vault.getMarkdownFiles).mockReturnValue([]);
    const result = getFilesWithTag("#nonexistent", app);
    expect(result).toHaveLength(0);
  });

  it("skips files with no cache", () => {
    const file = createMockFile({ path: "note.md" });
    vi.mocked(app.vault.getMarkdownFiles).mockReturnValue([file]);
    vi.mocked(app.metadataCache.getCache).mockReturnValue(null);
    const result = getFilesWithTag("#test", app);
    expect(result).toHaveLength(0);
  });
});
