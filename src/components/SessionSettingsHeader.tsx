import { Component, createSignal, Show } from "solid-js";

import { DEFAULT_MAX_STEPS } from "@/agent/agent-loop";
import type { SessionStore } from "@/session/session-store";
import type { ApprovalMode } from "@/session/types";

export interface SessionSettingsHeaderProps {
    store: SessionStore;
}

const MIN_STEPS = 1;
const MAX_STEPS_CEILING = 50;

/**
 * Compact header showing per-session overrides for the agent runtime. Today
 * covers `maxSteps` (hard ceiling on the agent loop) and `approvalMode`
 * (ask / auto / readonly). Both persist to the sidecar via the store so the
 * choices stick across reloads.
 *
 * Collapsed by default to keep the chat surface dense; click the chevron to
 * expand. The summary line still shows the active values so users see what's
 * in effect without expanding.
 */
export const SessionSettingsHeader: Component<SessionSettingsHeaderProps> = (
    props,
) => {
    const [open, setOpen] = createSignal(false);
    const settings = () => props.store.session.settings ?? {};
    const maxSteps = () => settings().maxSteps ?? DEFAULT_MAX_STEPS;
    const approvalMode = (): ApprovalMode =>
        settings().approvalMode ?? "ask";

    const onMaxStepsInput = (event: Event) => {
        const value = parseInt(
            (event.target as HTMLInputElement).value,
            10,
        );
        if (Number.isNaN(value)) return;
        const clamped = Math.max(
            MIN_STEPS,
            Math.min(MAX_STEPS_CEILING, value),
        );
        props.store.updateSettings({ maxSteps: clamped });
    };

    const onApprovalModeChange = (event: Event) => {
        const value = (event.target as HTMLSelectElement)
            .value as ApprovalMode;
        props.store.updateSettings({ approvalMode: value });
    };

    return (
        <div class="coi-session-settings">
            <button
                type="button"
                class="coi-session-settings-summary"
                onClick={() => setOpen((prev) => !prev)}
                aria-expanded={open()}
            >
                <span class="coi-session-settings-chevron" aria-hidden="true">
                    {open() ? "▾" : "▸"}
                </span>
                <span>Session settings</span>
                <span class="coi-session-settings-summary-values">
                    {approvalMode()} · {maxSteps()} step
                    {maxSteps() === 1 ? "" : "s"}
                </span>
            </button>
            <Show when={open()}>
                <div class="coi-session-settings-body">
                    <label class="coi-session-settings-field">
                        <span>Max steps</span>
                        <input
                            type="number"
                            min={MIN_STEPS}
                            max={MAX_STEPS_CEILING}
                            value={maxSteps()}
                            onChange={onMaxStepsInput}
                        />
                    </label>
                    <label class="coi-session-settings-field">
                        <span>Approval mode</span>
                        <select
                            value={approvalMode()}
                            onChange={onApprovalModeChange}
                        >
                            <option value="ask">
                                ask — confirm before write tools
                            </option>
                            <option value="auto">
                                auto — run everything immediately
                            </option>
                            <option value="readonly">
                                readonly — refuse write tools
                            </option>
                        </select>
                    </label>
                </div>
            </Show>
        </div>
    );
};
