import { htmlToMarkdown, requestUrl } from "obsidian";
import { z } from "zod";

import type { CoiTool } from "@/agent/types";

const inputSchema = z.object({
    url: z
        .string()
        .url("must be a valid URL (include the scheme)")
        .describe("Absolute URL to fetch."),
});

type Input = z.infer<typeof inputSchema>;

interface Output {
    url: string;
    status: number;
    title: string | null;
    markdown: string;
}

/**
 * `fetch_url` — fetches a URL via Obsidian's `requestUrl` (mobile-safe; no
 * Node) and converts the HTML body to markdown. JSON / plaintext responses
 * are returned as-is in the `markdown` field. Read-only; no approval.
 */
export const fetchUrlTool: CoiTool<Input, Output> = {
    name: "fetch_url",
    description:
        "Fetch a web page and return its main content as markdown. Use this when the agent needs to read external pages the model wasn't trained on.",
    inputSchema,
    requiresApproval: false,
    scope: "web",
    platforms: ["desktop", "mobile"],
    async execute({ url }) {
        const response = await requestUrl({ url });
        const contentType = response.headers["content-type"] ?? "";
        const isHtml = contentType.includes("html");
        const title = isHtml ? extractTitle(response.text) : null;
        const markdown = isHtml ? htmlToMarkdown(response.text) : response.text;
        return {
            url,
            status: response.status,
            title,
            markdown,
        };
    },
};

function extractTitle(html: string): string | null {
    const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (!match) return null;
    return match[1].replace(/\s+/g, " ").trim() || null;
}
