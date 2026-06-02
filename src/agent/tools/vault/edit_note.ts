import { TFile, normalizePath } from "obsidian";
import { z } from "zod";

import type { CoiTool } from "@/agent/types";
import { attemptEdit, makeUnifiedDiff } from "@/utils/edit-note-diff";

const inputSchema = z.object({
    path: z
        .string()
        .min(1, "path is required")
        .describe("Vault-relative path to the note."),
    oldText: z
        .string()
        .min(1, "oldText is required")
        .describe(
            "Exact text to find and replace. Must be unique in the note unless replaceAll=true.",
        ),
    newText: z
        .string()
        .describe("Text to replace oldText with. Empty string deletes."),
    replaceAll: z
        .boolean()
        .default(false)
        .describe(
            "When false (default), errors if oldText appears more than once. When true, every occurrence is replaced.",
        ),
});

type Input = z.infer<typeof inputSchema>;

interface Output {
    path: string;
    replacements: number;
    /** Unified-style diff of the edit, suitable for rendering in the approval UI. */
    diff: string;
}

/**
 * `edit_note` — replace `oldText` with `newText` in a vault note via
 * `Vault.process`. Defaults to single-occurrence; refuses ambiguous matches
 * unless `replaceAll` is set. Returns a unified-style diff so the Phase 5
 * approval UI (#67) can render a diff card. Requires approval.
 */
export const editNoteTool: CoiTool<Input, Output> = {
    name: "edit_note",
    description:
        "Edit a vault note by replacing exact text. Returns a unified-style diff of the change. Requires approval before writing.",
    inputSchema,
    requiresApproval: true,
    scope: "vault",
    platforms: ["desktop", "mobile"],
    async execute({ path, oldText, newText, replaceAll }, { app }) {
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

        let result: { replacements: number; before: string; after: string } = {
            replacements: 0,
            before: "",
            after: "",
        };

        await app.vault.process(file, (current) => {
            const outcome = attemptEdit(
                { content: current, oldText, newText, replaceAll },
                normalized,
            );
            if (outcome.kind === "error") {
                throw new Error(outcome.message);
            }
            result = {
                replacements: outcome.replacements,
                before: current,
                after: outcome.after,
            };
            return outcome.after;
        });

        return {
            path: normalized,
            replacements: result.replacements,
            diff: makeUnifiedDiff(normalized, result.before, result.after),
        };
    },
};
