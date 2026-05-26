import { normalizePath, stringifyYaml } from "obsidian";
import { z } from "zod";

import type { CoiTool } from "@/agent/types";

const inputSchema = z.object({
    path: z
        .string()
        .min(1, "path is required")
        .describe(
            "Vault-relative path for the new note, including the `.md` extension.",
        ),
    content: z
        .string()
        .default("")
        .describe("Markdown body. Omit or pass empty string for a blank note."),
    frontmatter: z
        .record(z.string(), z.unknown())
        .optional()
        .describe(
            "Optional YAML frontmatter object. Rendered as a `---` block at the top of the note.",
        ),
});

type Input = z.infer<typeof inputSchema>;

interface Output {
    path: string;
    size: number;
}

/**
 * `create_note` — creates a new note at `path`. Fails if a file already
 * exists there (use `edit_note` or `append_to_note` instead). Frontmatter is
 * serialized via Obsidian's `stringifyYaml`. Requires approval.
 */
export const createNoteTool: CoiTool<Input, Output> = {
    name: "create_note",
    description:
        "Create a new note at the given vault path with optional frontmatter and body. Fails if a file already exists at that path.",
    inputSchema,
    requiresApproval: true,
    scope: "vault",
    platforms: ["desktop", "mobile"],
    async execute({ path, content, frontmatter }, { app }) {
        const normalized = normalizePath(path);
        if (app.vault.getAbstractFileByPath(normalized)) {
            throw new Error(`A file already exists at "${normalized}"`);
        }
        const body = frontmatter
            ? `---\n${stringifyYaml(frontmatter)}---\n${content}`
            : content;
        const created = await app.vault.create(normalized, body);
        return { path: created.path, size: body.length };
    },
};
