import { Component, createEffect } from "solid-js";

export interface ProcessingIndicatorProps {
  onCancel?: () => void;
}

export const ProcessingIndicator: Component<ProcessingIndicatorProps> = ({
  onCancel,
}) => {
  // Logging to confirm the component is rendering
  createEffect(() => {
    console.log("Processing indicator rendered");
  });

  return (
    <div class="coi-processing-indicator">
      <div class="coi-processing-spinner"></div>
      <div class="coi-processing-text">Generating response...</div>
      <button
        class="coi-cancel-button"
        onClick={onCancel}
        title="Cancel request"
      >
        Cancel
      </button>
    </div>
  );
};