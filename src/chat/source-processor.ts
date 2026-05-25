import type { Source } from "@/types";
import { ensureSourceTitle } from "@/utils/url";

/**
 * Minimal shape we need from the AI SDK's `streamText` `sources` payload.
 * The SDK's full `Source` type is not exported, so we narrow here and accept
 * the wider union by structural compatibility at call sites.
 */
export type RawSource =
    | { sourceType: "url"; url: string; title?: string }
    | { sourceType: string; [key: string]: unknown };

export interface ProcessNumberedSourcesParams {
    rawSources: RawSource[];
    content: string;
    offset: number;
}

export interface ProcessNumberedSourcesResult {
    content: string;
    newSources: Source[];
}

/**
 * Processes Perplexity-style numbered references. Filters the raw provider
 * sources down to URL sources, deduplicates by URL, and rewrites bracketed
 * numbers (`[n]`) in the content into markdown links (` [n+offset](url)`)
 * pointing at the matching source. Returns the rewritten content and the
 * unique URL sources the caller should append.
 */
export function processNumberedSources(
    params: ProcessNumberedSourcesParams,
): ProcessNumberedSourcesResult {
    const { rawSources, content, offset } = params;

    const urlSources = rawSources.filter(
        (s): s is Extract<RawSource, { sourceType: "url" }> =>
            s.sourceType === "url",
    );
    const sourcesWithTitles = urlSources.map(ensureSourceTitle);
    const uniqueNewSources = sourcesWithTitles.filter(
        (source, index, arr) =>
            arr.findIndex((s) => s.url === source.url) === index,
    );

    const updatedContent = content.replace(
        /\[(\d+)\]/g,
        (match: string, num: string) => {
            const source = uniqueNewSources[parseInt(num) - 1];
            if (!source) return match;
            return ` [${parseInt(num) + offset}](${source.url})`;
        },
    );

    return { content: updatedContent, newSources: uniqueNewSources };
}

export interface ExtractMarkdownLinkSourcesParams {
    content: string;
    existingSources: Source[];
}

/**
 * Scans assistant content for markdown links (`[text](url)`) and returns the
 * subset whose URLs aren't already present in `existingSources`. Duplicates
 * within the content itself are also collapsed. Titles fall back to the URL's
 * domain when the link text is empty or whitespace.
 */
export function extractMarkdownLinkSources(
    params: ExtractMarkdownLinkSourcesParams,
): Source[] {
    const { content, existingSources } = params;
    const matches = content.match(/\[(.*?)\]\((.*?)\)/g) || [];

    const seenUrls = new Set(existingSources.map((s) => s.url));
    const newSources: Source[] = [];

    for (const match of matches) {
        const [text, url] = match.slice(1, -1).split("](");
        if (!url || seenUrls.has(url)) continue;
        newSources.push(ensureSourceTitle({ url, title: text }));
        seenUrls.add(url);
    }

    return newSources;
}
