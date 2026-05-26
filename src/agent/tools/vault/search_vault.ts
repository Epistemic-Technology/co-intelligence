import { TFile } from "obsidian";
import { z } from "zod";

import type { CoiTool } from "@/agent/types";

const inputSchema = z.object({
    query: z
        .string()
        .min(1, "query is required")
        .describe(
            "Search term. Matches case-insensitively against note basenames and (when content=true) note bodies.",
        ),
    content: z
        .boolean()
        .default(false)
        .describe(
            "When true, scans note bodies and returns a snippet for each hit. Slower; use only when filename search isn't enough.",
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
 * `search_vault` — finds notes by filename, and optionally by body content.
 * Returns up to `limit` hits with a snippet around the first content match.
 * Read-only; no approval.
 */
export const searchVaultTool: CoiTool<Input, Output> = {
    name: "search_vault",
    description:
        "Search vault notes by filename (always) and optionally by body content. Returns matching note paths with a short snippet around content matches.",
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
                nameHits.push({ path: file.path, name: file.basename });
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
                    path: file.path,
                    name: file.basename,
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

function makeSnippet(body: string, idx: number, matchLen: number): string {
    const start = Math.max(0, idx - SNIPPET_RADIUS);
    const end = Math.min(body.length, idx + matchLen + SNIPPET_RADIUS);
    const prefix = start > 0 ? "…" : "";
    const suffix = end < body.length ? "…" : "";
    return prefix + body.slice(start, end).replace(/\s+/g, " ").trim() + suffix;
}
