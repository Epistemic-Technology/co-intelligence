import { App, Modal } from "obsidian";
import { createEffect, createRoot } from "solid-js";

import type {
    ApprovalDecision,
    PendingApproval,
    PermissionBroker,
} from "@/agent/permission-broker";

/**
 * Renders an Obsidian {@link Modal} for each pending approval emitted by the
 * broker. Interim Phase 3 UI — replaced in Phase 5 by an in-chat approval card
 * (issue #66). The modal is intentionally minimal: tool name, JSON args, and
 * three buttons (allow / deny / always).
 *
 * Returns a dispose function that tears down both the Solid root and any open
 * modal. Safe to call on plugin unload.
 */
export function mountApprovalModalBroker(
    broker: PermissionBroker,
    app: App,
): () => void {
    const seen = new Set<string>();
    let activeModal: ToolApprovalModal | null = null;

    return createRoot((dispose) => {
        createEffect(() => {
            const queue = broker.pending();
            for (const entry of queue) {
                if (seen.has(entry.toolCallId)) continue;
                seen.add(entry.toolCallId);
                openOne(entry);
            }
        });

        return () => {
            if (activeModal) {
                activeModal.close();
                activeModal = null;
            }
            seen.clear();
            dispose();
        };
    });

    function openOne(entry: PendingApproval) {
        const modal = new ToolApprovalModal(app, entry, (decision) => {
            broker.resolve(entry.toolCallId, decision);
            if (activeModal === modal) {
                activeModal = null;
            }
        });
        activeModal = modal;
        modal.open();
    }
}

class ToolApprovalModal extends Modal {
    private readonly entry: PendingApproval;
    private readonly onDecision: (decision: ApprovalDecision) => void;
    private decided = false;

    constructor(
        app: App,
        entry: PendingApproval,
        onDecision: (decision: ApprovalDecision) => void,
    ) {
        super(app);
        this.entry = entry;
        this.onDecision = onDecision;
    }

    onOpen(): void {
        const { titleEl, contentEl } = this;
        titleEl.setText(`Approve tool: ${this.entry.toolName}`);

        const desc = contentEl.createEl("p", {
            text: "The assistant wants to run the following tool. Review the arguments before allowing.",
        });
        desc.addClass("coi-approval-desc");

        const argsEl = contentEl.createEl("pre");
        argsEl.addClass("coi-approval-args");
        argsEl.setText(formatInput(this.entry.input));

        const buttons = contentEl.createEl("div");
        buttons.addClass("coi-approval-buttons");

        this.addButton(buttons, "Deny", "deny");
        this.addButton(buttons, "Allow", "allow");
        this.addButton(buttons, "Always allow", "always");
    }

    onClose(): void {
        this.contentEl.empty();
        if (!this.decided) {
            this.decided = true;
            this.onDecision("deny");
        }
    }

    private addButton(
        parent: HTMLElement,
        label: string,
        decision: ApprovalDecision,
    ): void {
        const btn = parent.createEl("button", { text: label });
        if (decision === "allow") {
            btn.addClass("mod-cta");
        }
        btn.addEventListener("click", () => {
            if (this.decided) return;
            this.decided = true;
            this.onDecision(decision);
            this.close();
        });
    }
}

function formatInput(input: unknown): string {
    try {
        return JSON.stringify(input, null, 2);
    } catch {
        return String(input);
    }
}
