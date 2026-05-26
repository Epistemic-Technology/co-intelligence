import { TFile, normalizePath } from "obsidian";
import { z } from "zod";

import type { CoiTool } from "@/agent/types";

const inputSchema = z.object({
    path: z
        .string()
        .min(1, "path is required")
        .describe("Vault-relative path to the note to append to."),
    content: z
        .string()
        .min(1, "content is required")
        .describe(
            "Text to append. A blank line is inserted between existing content and the new text when the existing content doesn't already end with one.",
        ),
});

type Input = z.infer<typeof inputSchema>;

interface Output {
    path: string;
    bytesAppended: number;
    newSize: number;
}

/**
 * `append_to_note` — appends to an existing note via `Vault.process`. Inserts
 * a blank-line separator when needed so the appended content doesn't run on
 * from the previous line. Requires approval.
 */
export const appendToNoteTool: CoiTool<Input, Output> = {
    name: "append_to_note",
    description:
        "Append content to the end of an existing vault note. Inserts a blank-line separator when needed.",
    inputSchema,
    requiresApproval: true,
    scope: "vault",
    platforms: ["desktop", "mobile"],
    async execute({ path, content }, { app }) {
        const normalized = normalizePath(path);
        const file = app.vault.getAbstractFileByPath(normalized);
        if (!file) {
            throw new Error(`Note not found at "${normalized}"`);
        }
        if (!(file instanceof TFile)) {
            throw new Error(
                `Path "${normalized}" refers to a folder, not a note`,
            );
        }
        let newSize = 0;
        await app.vault.process(file, (current) => {
            const separator = current.endsWith("\n\n") || current === ""
                ? ""
                : current.endsWith("\n")
                  ? "\n"
                  : "\n\n";
            const next = current + separator + content;
            newSize = next.length;
            return next;
        });
        return {
            path: normalized,
            bytesAppended: content.length,
            newSize,
        };
    },
};
