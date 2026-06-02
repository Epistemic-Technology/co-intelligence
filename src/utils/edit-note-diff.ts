export interface EditAttempt {
    content: string;
    oldText: string;
    newText: string;
    replaceAll: boolean;
}

export type EditOutcome =
    | { kind: "ok"; replacements: number; after: string }
    | {
          kind: "error";
          reason: "not-found" | "ambiguous";
          replacements: number;
          message: string;
      };

/**
 * Mirrors edit_note's replacement logic exactly so the approval-time diff
 * preview matches the actual write — including the "ambiguous match"
 * refusal. Pulled out of the tool so the ApprovalPrompt can compute its
 * preview without going through `Vault.process`.
 */
export function attemptEdit(
    attempt: EditAttempt,
    pathLabel: string,
): EditOutcome {
    const occurrences = countOccurrences(attempt.content, attempt.oldText);
    if (occurrences === 0) {
        return {
            kind: "error",
            reason: "not-found",
            replacements: 0,
            message: `oldText not found in "${pathLabel}"`,
        };
    }
    if (occurrences > 1 && !attempt.replaceAll) {
        return {
            kind: "error",
            reason: "ambiguous",
            replacements: occurrences,
            message: `oldText appears ${occurrences} times in "${pathLabel}"; set replaceAll=true or narrow the match`,
        };
    }
    const after = attempt.replaceAll
        ? attempt.content.split(attempt.oldText).join(attempt.newText)
        : attempt.content.replace(attempt.oldText, attempt.newText);
    return { kind: "ok", replacements: occurrences, after };
}

export function countOccurrences(haystack: string, needle: string): number {
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
 * need patch round-trip — just a human-readable summary the approval card
 * can show line-by-line.
 */
export function makeUnifiedDiff(
    path: string,
    before: string,
    after: string,
): string {
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
