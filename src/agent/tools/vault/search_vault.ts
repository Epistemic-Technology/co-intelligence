import { TFile } from "obsidian";
import { z } from "zod";

import type { CoiTool } from "@/agent/types";

const inputSchema = z.object({
    query: z
        .string()
        .min(1, "query is required")
        .describe(
            "Search term. Matches case-insensitively against note basenames and note bodies.",
        ),
    content: z
        .boolean()
        .default(true)
        .describe(
            "When true (default), scans note bodies and returns a snippet for each hit. Set false to match filenames only.",
        ),
    limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(20)
        .describe("Maximum results to return."),
});

type Input = z.infer<typeof inputSchema>;

interface Hit {
    path: string;
    name: string;
    /** Obsidian wikilink form (e.g. `[[Foo]]`) ready for inline use. */
    wikilink: string;
    /** Present only when content scan matched. ~120 chars around the first hit. */
    snippet?: string;
}

interface Output {
    query: string;
    hits: Hit[];
    truncated: boolean;
}

const SNIPPET_RADIUS = 60;

/**
 * `search_vault` — finds notes by filename and body content (both by default).
 * Each hit includes a `wikilink` field so the assistant can cite results with
 * Obsidian `[[Note]]` links — the description below tells it to do exactly
 * that.
 */
export const searchVaultTool: CoiTool<Input, Output> = {
    name: "search_vault",
    description:
        "Search vault notes by filename and content. Returns matching notes with a snippet around content matches. When referencing results in your answer, cite them with their `wikilink` field (e.g. [[Note]]) so the user can click through.",
    inputSchema,
    requiresApproval: false,
    scope: "vault",
    platforms: ["desktop", "mobile"],
    async execute({ query, content, limit }, { app }) {
        const needle = query.toLowerCase();
        const files = app.vault.getMarkdownFiles();

        const nameHits: Hit[] = [];
        const contentCandidates: TFile[] = [];

        for (const file of files) {
            if (file.basename.toLowerCase().includes(needle)) {
                nameHits.push(makeHit(file));
                if (nameHits.length >= limit) break;
            } else if (content) {
                contentCandidates.push(file);
            }
        }

        let truncated = nameHits.length >= limit;
        const hits = nameHits.slice(0, limit);

        if (content && hits.length < limit) {
            for (const file of contentCandidates) {
                const body = await app.vault.cachedRead(file);
                const idx = body.toLowerCase().indexOf(needle);
                if (idx === -1) continue;
                hits.push({
                    ...makeHit(file),
                    snippet: makeSnippet(body, idx, needle.length),
                });
                if (hits.length >= limit) {
                    truncated = true;
                    break;
                }
            }
        }

        return { query, hits, truncated };
    },
};

function makeHit(file: TFile): Hit {
    return {
        path: file.path,
        name: file.basename,
        wikilink: `[[${file.basename}]]`,
    };
}

function makeSnippet(body: string, idx: number, matchLen: number): string {
    const start = Math.max(0, idx - SNIPPET_RADIUS);
    const end = Math.min(body.length, idx + matchLen + SNIPPET_RADIUS);
    const prefix = start > 0 ? "…" : "";
    const suffix = end < body.length ? "…" : "";
    return prefix + body.slice(start, end).replace(/\s+/g, " ").trim() + suffix;
}
