import { Component, Show, createResource, useContext } from "solid-js";
import { TFile, normalizePath } from "obsidian";

import { AppContext } from "@/CoiChatApp";
import type {
    ApprovalDecision,
    PendingApproval,
} from "@/agent/permission-broker";
import { ApprovalPrompt } from "@/components/parts/ApprovalPrompt";
import { DiffView } from "@/components/parts/DiffView";
import { attemptEdit, makeUnifiedDiff } from "@/utils/edit-note-diff";

export interface EditNoteApprovalPromptProps {
    request: PendingApproval;
    onDecide: (decision: ApprovalDecision) => void;
}

interface EditNoteInput {
    path: string;
    oldText: string;
    newText: string;
    replaceAll?: boolean;
}

type PreviewState =
    | { kind: "diff"; diff: string; replacements: number }
    | { kind: "missing-file"; path: string }
    | { kind: "edit-error"; message: string };

/**
 * edit_note-specific approval card. Re-uses the generic ApprovalPrompt
 * shell but swaps the default JSON args block for a pre-write diff
 * preview, computed with the same `attemptEdit` helper edit_note runs
 * under `Vault.process` — so what the user approves is byte-for-byte
 * what will be written.
 */
export const EditNoteApprovalPrompt: Component<EditNoteApprovalPromptProps> = (
    props,
) => {
    const app = useContext(AppContext);
    const input = () => props.request.input as EditNoteInput;

    const [preview] = createResource(
        () => input(),
        async (i): Promise<PreviewState> => {
            if (!app) return { kind: "missing-file", path: i.path };
            const normalized = normalizePath(i.path);
            const file = app.vault.getAbstractFileByPath(normalized);
            if (!file || !(file instanceof TFile)) {
                return { kind: "missing-file", path: normalized };
            }
            const current = await app.vault.cachedRead(file);
            const outcome = attemptEdit(
                {
                    content: current,
                    oldText: i.oldText,
                    newText: i.newText,
                    replaceAll: i.replaceAll ?? false,
                },
                normalized,
            );
            if (outcome.kind === "error") {
                return { kind: "edit-error", message: outcome.message };
            }
            return {
                kind: "diff",
                diff: makeUnifiedDiff(normalized, current, outcome.after),
                replacements: outcome.replacements,
            };
        },
    );

    return (
        <ApprovalPrompt request={props.request} onDecide={props.onDecide}>
            <div class="coi-edit-preview">
                <Show
                    when={preview.loading || !preview()}
                    fallback={<RenderedPreview state={preview()!} />}
                >
                    <div class="coi-edit-preview-loading">
                        Computing diff…
                    </div>
                </Show>
            </div>
        </ApprovalPrompt>
    );
};

const RenderedPreview: Component<{ state: PreviewState }> = (props) => {
    const state = () => props.state;
    return (
        <>
            {state().kind === "diff" && (
                <>
                    <div class="coi-edit-preview-summary">
                        {pluralReplacements(
                            (state() as { replacements: number })
                                .replacements,
                        )}
                    </div>
                    <DiffView diff={(state() as { diff: string }).diff} />
                </>
            )}
            {state().kind === "missing-file" && (
                <div class="coi-edit-preview-error">
                    Note not found at "
                    {(state() as { path: string }).path}".
                </div>
            )}
            {state().kind === "edit-error" && (
                <div class="coi-edit-preview-error">
                    {(state() as { message: string }).message}
                </div>
            )}
        </>
    );
};

function pluralReplacements(n: number): string {
    return `${n} replacement${n === 1 ? "" : "s"}`;
}
