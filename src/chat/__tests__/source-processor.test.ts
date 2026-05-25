import { describe, it, expect } from "vitest";
import {
    processNumberedSources,
    extractMarkdownLinkSources,
    type RawSource,
} from "@/chat/source-processor";

function urlSource(url: string, title?: string): RawSource {
    return { sourceType: "url", url, title };
}

describe("processNumberedSources", () => {
    it("returns the original content and empty sources when no raw sources", () => {
        const result = processNumberedSources({
            rawSources: [],
            content: "no refs here",
            offset: 0,
        });
        expect(result.content).toBe("no refs here");
        expect(result.newSources).toEqual([]);
    });

    it("filters out non-url sources", () => {
        const result = processNumberedSources({
            rawSources: [
                urlSource("https://a.example", "A"),
                {
                    sourceType: "document",
                    id: "doc1",
                    mediaType: "application/pdf",
                    title: "Doc",
                },
            ],
            content: "[1] [2]",
            offset: 0,
        });
        expect(result.newSources).toHaveLength(1);
        expect(result.newSources[0].url).toBe("https://a.example");
    });

    it("dedupes raw sources by url, preserving first occurrence", () => {
        const result = processNumberedSources({
            rawSources: [
                urlSource("https://a.example", "first"),
                urlSource("https://a.example", "duplicate"),
                urlSource("https://b.example", "second"),
            ],
            content: "",
            offset: 0,
        });
        expect(result.newSources.map((s) => s.url)).toEqual([
            "https://a.example",
            "https://b.example",
        ]);
        expect(result.newSources[0].title).toBe("first");
    });

    it("rewrites bracketed numbers into markdown links with offset applied", () => {
        const result = processNumberedSources({
            rawSources: [
                urlSource("https://a.example", "A"),
                urlSource("https://b.example", "B"),
            ],
            content: "see [1] and [2]",
            offset: 3,
        });
        expect(result.content).toBe(
            "see  [4](https://a.example) and  [5](https://b.example)",
        );
    });

    it("leaves bracketed numbers without a matching source untouched", () => {
        const result = processNumberedSources({
            rawSources: [urlSource("https://a.example", "A")],
            content: "[1] then [9]",
            offset: 0,
        });
        expect(result.content).toBe(" [1](https://a.example) then [9]");
    });

    it("ensures missing titles fall back to the domain", () => {
        const result = processNumberedSources({
            rawSources: [urlSource("https://example.com/page")],
            content: "",
            offset: 0,
        });
        expect(result.newSources[0].title).toBe("example.com");
    });

    it("does not mutate the input content string", () => {
        const content = "[1]";
        processNumberedSources({
            rawSources: [urlSource("https://a.example", "A")],
            content,
            offset: 0,
        });
        expect(content).toBe("[1]");
    });
});

describe("extractMarkdownLinkSources", () => {
    it("returns an empty list when content has no links", () => {
        const result = extractMarkdownLinkSources({
            content: "just text",
            existingSources: [],
        });
        expect(result).toEqual([]);
    });

    it("extracts a markdown link into a Source", () => {
        const result = extractMarkdownLinkSources({
            content: "see [Example](https://example.com)",
            existingSources: [],
        });
        expect(result).toEqual([
            { url: "https://example.com", title: "Example" },
        ]);
    });

    it("skips urls already in existingSources", () => {
        const result = extractMarkdownLinkSources({
            content: "[A](https://a.example) and [B](https://b.example)",
            existingSources: [{ url: "https://a.example", title: "A" }],
        });
        expect(result).toEqual([{ url: "https://b.example", title: "B" }]);
    });

    it("dedupes repeats within the same content", () => {
        const result = extractMarkdownLinkSources({
            content: "[X](https://x.example) and again [X](https://x.example)",
            existingSources: [],
        });
        expect(result).toEqual([{ url: "https://x.example", title: "X" }]);
    });

    it("falls back to domain when link text is empty", () => {
        const result = extractMarkdownLinkSources({
            content: "see [](https://example.com/page)",
            existingSources: [],
        });
        expect(result[0].title).toBe("example.com");
    });

    it("does not mutate existingSources", () => {
        const existingSources = [{ url: "https://a.example", title: "A" }];
        extractMarkdownLinkSources({
            content: "[B](https://b.example)",
            existingSources,
        });
        expect(existingSources).toEqual([
            { url: "https://a.example", title: "A" },
        ]);
    });
});
