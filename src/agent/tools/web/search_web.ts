import { requestUrl } from "obsidian";
import { z } from "zod";

import { getApiKey } from "@/settings";
import type { CoiTool } from "@/agent/types";

const inputSchema = z.object({
    query: z.string().min(1, "query is required").describe("Search query."),
});

type Input = z.infer<typeof inputSchema>;

interface SearchHit {
    title?: string;
    url: string;
    snippet?: string;
}

interface Output {
    query: string;
    answer: string;
    citations: SearchHit[];
}

interface PerplexityChoice {
    message?: { content?: string };
}

interface PerplexityCitation {
    title?: string;
    url: string;
    snippet?: string;
}

interface PerplexityResponse {
    choices?: PerplexityChoice[];
    citations?: (string | PerplexityCitation)[];
    search_results?: PerplexityCitation[];
}

/**
 * `search_web` — runs a web search via Perplexity's sonar model and returns
 * the synthesized answer + cited sources. Provider-agnostic from the agent's
 * perspective: works even when the conversation model is OpenAI / Anthropic /
 * Google without their native search tool. Gated on a configured Perplexity
 * API key — {@link isSearchWebAvailable} answers whether it should be
 * registered. Read-only; no approval.
 */
export const searchWebTool: CoiTool<Input, Output> = {
    name: "search_web",
    description:
        "Search the live web with a query. Returns a synthesized answer plus cited source URLs. Use when the model lacks recent information.",
    inputSchema,
    requiresApproval: false,
    scope: "web",
    platforms: ["desktop", "mobile"],
    async execute({ query }, { app }) {
        const apiKey = getApiKey(app, "perplexity");
        if (!apiKey) {
            throw new Error(
                "search_web is not configured: set a Perplexity API key in Co-Intelligence settings",
            );
        }
        const response = await requestUrl({
            url: "https://api.perplexity.ai/chat/completions",
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "sonar",
                messages: [
                    {
                        role: "system",
                        content:
                            "You are a concise web research assistant. Answer the user's query using current web sources.",
                    },
                    { role: "user", content: query },
                ],
            }),
        });
        const data = response.json as PerplexityResponse;
        const answer = data.choices?.[0]?.message?.content ?? "";
        const citations = extractCitations(data);
        return { query, answer, citations };
    },
};

/**
 * Returns true when the runtime has the credentials needed to register the
 * tool. The plugin uses this to decide whether to include `search_web` in the
 * default registry.
 */
export function isSearchWebAvailable(
    app: import("obsidian").App,
): boolean {
    return getApiKey(app, "perplexity") !== "";
}

function extractCitations(data: PerplexityResponse): SearchHit[] {
    const raw = data.search_results ?? data.citations ?? [];
    return raw
        .map<SearchHit | null>((entry) => {
            if (typeof entry === "string") return { url: entry };
            if (entry && typeof entry === "object" && "url" in entry) {
                return {
                    url: entry.url,
                    title: entry.title,
                    snippet: entry.snippet,
                };
            }
            return null;
        })
        .filter((c): c is SearchHit => c !== null);
}
