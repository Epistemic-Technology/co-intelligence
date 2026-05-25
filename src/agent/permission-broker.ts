import { type Accessor, createSignal } from "solid-js";

export type ApprovalDecision = "allow" | "deny" | "always";

export interface ApprovalRequest {
    toolCallId: string;
    toolName: string;
    input: unknown;
}

export interface PendingApproval extends ApprovalRequest {
    resolve: (decision: ApprovalDecision) => void;
}

export interface PermissionBroker {
    /** Reactive accessor of currently-pending approvals. */
    pending: Accessor<PendingApproval[]>;

    /**
     * Returns a promise that resolves with the user's decision. If the tool
     * already has a standing approval (`hasStandingApproval`), resolves with
     * `"allow"` immediately without enqueueing.
     */
    requestApproval(request: ApprovalRequest): Promise<ApprovalDecision>;

    /**
     * Resolves a pending approval. If `decision === "always"`, the tool name
     * is added to the standing approval set so subsequent requests bypass the
     * queue.
     */
    resolve(toolCallId: string, decision: ApprovalDecision): void;

    /** Denies every pending approval. Useful when cancelling a request. */
    denyAll(): void;

    /** Whether `toolName` has been granted a standing approval. */
    hasStandingApproval(toolName: string): boolean;

    /** Adds `toolName` to the standing approval set. */
    grantStandingApproval(toolName: string): void;

    /** Removes a tool's standing approval. */
    revokeStandingApproval(toolName: string): void;

    /** Clears pending approvals and the standing approval set. */
    clear(): void;
}

/**
 * Creates a permission broker. The broker is the single coordination point
 * between the agent loop (producer of approval requests) and the UI (consumer
 * via the `pending` signal). Calling `resolve` from a UI handler resumes the
 * `requestApproval` promise.
 */
export function createPermissionBroker(): PermissionBroker {
    const [pending, setPending] = createSignal<PendingApproval[]>([]);
    const standing = new Set<string>();

    const findAndRemove = (
        toolCallId: string,
    ): PendingApproval | undefined => {
        const queue = pending();
        const entry = queue.find((p) => p.toolCallId === toolCallId);
        if (!entry) return undefined;
        setPending(queue.filter((p) => p.toolCallId !== toolCallId));
        return entry;
    };

    return {
        pending,

        async requestApproval(request) {
            if (standing.has(request.toolName)) {
                return "allow";
            }
            return new Promise<ApprovalDecision>((resolve) => {
                setPending((queue) => [...queue, { ...request, resolve }]);
            });
        },

        resolve(toolCallId, decision) {
            const entry = findAndRemove(toolCallId);
            if (!entry) return;
            if (decision === "always") {
                standing.add(entry.toolName);
            }
            entry.resolve(decision);
        },

        denyAll() {
            const queue = pending();
            setPending([]);
            for (const entry of queue) {
                entry.resolve("deny");
            }
        },

        hasStandingApproval(toolName) {
            return standing.has(toolName);
        },

        grantStandingApproval(toolName) {
            standing.add(toolName);
        },

        revokeStandingApproval(toolName) {
            standing.delete(toolName);
        },

        clear() {
            const queue = pending();
            setPending([]);
            standing.clear();
            for (const entry of queue) {
                entry.resolve("deny");
            }
        },
    };
}
