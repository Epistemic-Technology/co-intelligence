import { Accessor, Component, Show } from "solid-js";

export interface ProcessingIndicatorProps {
    onCancel?: () => void;
    /** Current step index (1-based). When undefined or 0 we omit the badge. */
    currentStep?: Accessor<number>;
    /** Step ceiling — paired with `currentStep` to render `Step N / M`. */
    maxSteps?: Accessor<number>;
}

/**
 * In-flight indicator shown at the bottom of ChatHistory while the controller
 * is processing. When the agent loop is running multi-step (current step ≥ 1)
 * we tack on a `Step N / M` badge so the user can see progress against the
 * step ceiling. Cancel still calls back to the controller's cancel().
 */
export const ProcessingIndicator: Component<ProcessingIndicatorProps> = (
    props,
) => {
    const step = () => props.currentStep?.() ?? 0;
    const max = () => props.maxSteps?.() ?? 0;
    return (
        <div class="coi-processing-indicator">
            <div class="coi-processing-spinner" aria-hidden="true"></div>
            <div class="coi-processing-text">Generating response…</div>
            <Show when={step() > 0 && max() > 0}>
                <span
                    class="coi-processing-step-badge"
                    aria-label={`Step ${step()} of ${max()}`}
                >
                    Step {step()} / {max()}
                </span>
            </Show>
            <button
                type="button"
                class="coi-cancel-button"
                onClick={props.onCancel}
                title="Cancel request"
            >
                Cancel
            </button>
        </div>
    );
};
