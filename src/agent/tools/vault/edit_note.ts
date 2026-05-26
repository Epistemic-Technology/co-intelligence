import { TFile, normalizePath } from "obsidian";
import { z } from "zod";

import type { CoiTool } from "@/agent/types";

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
            const occurrences = countOccurrences(current, oldText);
            if (occurrences === 0) {
                throw new Error(
                    `oldText not found in "${normalized}"`,
                );
            }
            if (occurrences > 1 && !replaceAll) {
                throw new Error(
                    `oldText appears ${occurrences} times in "${normalized}"; set replaceAll=true or narrow the match`,
                );
            }
            const next = replaceAll
                ? current.split(oldText).join(newText)
                : current.replace(oldText, newText);
            result = {
                replacements: occurrences,
                before: current,
                after: next,
            };
            return next;
        });

        return {
            path: normalized,
            replacements: result.replacements,
            diff: makeUnifiedDiff(normalized, result.before, result.after),
        };
    },
};

function countOccurrences(haystack: string, needle: string): number {
    let count = 0;
    let idx = 0;
    while ((idx = haystack.indexOf(needle, idx)) !== -1) {
        count++;
        idx += needle.length;
    }
    return count;
}

/**
 * Minimal unified-diff renderer. Not byte-exact with `diff` since we don't
 * need patch round-trip — just a human-readable summary the approval card can
 * show line-by-line.
 */
function makeUnifiedDiff(path: string, before: string, after: string): string {
    const beforeLines = before.split("\n");
    const afterLines = after.split("\n");
    const out: string[] = [`--- ${path}`, `+++ ${path}`];

    let i = 0;
    let j = 0;
    while (i < beforeLines.length || j < afterLines.length) {
        if (
            i < beforeLines.length &&
            j < afterLines.length &&
            beforeLines[i] === afterLines[j]
        ) {
            out.push(` ${beforeLines[i]}`);
            i++;
            j++;
            continue;
        }
        if (i < beforeLines.length) {
            out.push(`-${beforeLines[i]}`);
            i++;
        }
        if (j < afterLines.length) {
            out.push(`+${afterLines[j]}`);
            j++;
        }
    }

    return out.join("\n");
}
