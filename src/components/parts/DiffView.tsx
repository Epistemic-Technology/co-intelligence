import { Component, For } from "solid-js";

export interface DiffViewProps {
    diff: string;
}

type LineKind = "added" | "removed" | "context" | "header";

interface DiffLine {
    kind: LineKind;
    text: string;
}

function classify(line: string): DiffLine {
    if (line.startsWith("--- ") || line.startsWith("+++ ")) {
        return { kind: "header", text: line };
    }
    if (line.startsWith("+")) {
        return { kind: "added", text: line.slice(1) };
    }
    if (line.startsWith("-")) {
        return { kind: "removed", text: line.slice(1) };
    }
    if (line.startsWith(" ")) {
        return { kind: "context", text: line.slice(1) };
    }
    return { kind: "context", text: line };
}

/**
 * Pretty-prints a unified-style diff with per-line classes so adds / removes /
 * context can style independently. Used for both the pre-write preview in
 * the edit_note ApprovalPrompt and the post-write result card.
 */
export const DiffView: Component<DiffViewProps> = (props) => {
    const lines = (): DiffLine[] => props.diff.split("\n").map(classify);
    return (
        <pre class="coi-diff">
            <For each={lines()}>
                {(line) => (
                    <div class={`coi-diff-line coi-diff-${line.kind}`}>
                        <span class="coi-diff-marker">
                            {line.kind === "added"
                                ? "+"
                                : line.kind === "removed"
                                  ? "−"
                                  : line.kind === "header"
                                    ? ""
                                    : " "}
                        </span>
                        <span class="coi-diff-text">{line.text}</span>
                    </div>
                )}
            </For>
        </pre>
    );
};
