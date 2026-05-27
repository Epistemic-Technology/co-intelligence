import { App, requestUrl } from "obsidian";
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

export type SearchWebProvider = "tavily" | "perplexity";

interface Output {
    query: string;
    provider: SearchWebProvider;
    answer: string;
    citations: SearchHit[];
}

/**
 * `search_web` — runs a web search via Tavily or Perplexity (whichever has a
 * configured API key) and returns the synthesized answer + cited sources.
 * Provider-agnostic from the agent's perspective: works even when the
 * conversation model is OpenAI / Anthropic / Google without their native
 * search.
 *
 * When both keys are present, Tavily wins: it's purpose-built for agent
 * search and returns cleaner per-result snippets. Perplexity is the
 * fallback because it doubles as a chat provider users already configure.
 * Read-only; no approval.
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
        const provider = pickProvider(app);
        if (!provider) {
            throw new Error(
                "search_web is not configured: set a Tavily or Perplexity API key in Co-Intelligence settings",
            );
        }
        if (provider === "tavily") {
            return searchViaTavily(query, getApiKey(app, "tavily"));
        }
        return searchViaPerplexity(query, getApiKey(app, "perplexity"));
    },
};

/**
 * Returns the provider `search_web` will use given the current settings, or
 * null if neither is configured.
 */
export function pickProvider(app: App): SearchWebProvider | null {
    if (getApiKey(app, "tavily")) return "tavily";
    if (getApiKey(app, "perplexity")) return "perplexity";
    return null;
}

interface TavilyResult {
    title?: string;
    url: string;
    content?: string;
}

interface TavilyResponse {
    answer?: string;
    results?: TavilyResult[];
}

async function searchViaTavily(query: string, apiKey: string): Promise<Output> {
    const response = await requestUrl({
        url: "https://api.tavily.com/search",
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            query,
            search_depth: "basic",
            include_answer: true,
            max_results: 5,
        }),
    });
    const data = response.json as TavilyResponse;
    const citations: SearchHit[] = (data.results ?? []).map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.content,
    }));
    return {
        query,
        provider: "tavily",
        answer: data.answer ?? "",
        citations,
    };
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

async function searchViaPerplexity(
    query: string,
    apiKey: string,
): Promise<Output> {
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
    const raw = data.search_results ?? data.citations ?? [];
    const citations: SearchHit[] = raw
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
    return { query, provider: "perplexity", answer, citations };
}
