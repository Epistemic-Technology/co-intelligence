import { useContext, Accessor } from "solid-js";
import { ModelRegistry } from "@/services/model-registry";
import { PluginContext } from "@/CoiChatApp";
import { Model, ModelId } from "@/types";
import { LucideIcon } from "@/components/LucideIcon";

export interface ModelSelectorProps {
  selectedModel: Accessor<Model | null>;
  onModelChange: (model: Model | null) => void;
  label?: string;
  id?: string;
  showLabel?: boolean;
}

export const ModelSelector = ({
  selectedModel,
  onModelChange,
  label = "Select AI model",
  id = "model-selector",
  showLabel = false,
}: ModelSelectorProps) => {
  const plugin = useContext(PluginContext);
  const registry = ModelRegistry.getInstance(plugin);
  const hasModels = registry.availableModels.length > 0;

  return (
    <div class="coi-model-selector">
      {showLabel ? (
        <label for={id} class="coi-model-selector-label">
          <LucideIcon name="bot-message-square" aria-hidden="true" />
          {label}
        </label>
      ) : (
        <>
          <LucideIcon name="bot-message-square" aria-hidden="true" />
          <label for={id} class="coi-sr-only">
            {label}
          </label>
        </>
      )}
      <select
        id={id}
        value={selectedModel()?.id || ""}
        onChange={(e) => {
          const model = registry.getModel(e.target.value as ModelId);
          if (model) {
            onModelChange(model);
          } else {
            onModelChange(null);
          }
        }}
        disabled={!hasModels}
        aria-label={hasModels ? undefined : "No models available"}
        aria-describedby={hasModels ? undefined : `${id}-description`}
      >
        {hasModels ? (
          registry.availableModels.map((model) => (
            <option value={model.id}>{model.name}</option>
          ))
        ) : (
          <option value="">No available models</option>
        )}
      </select>
      {!hasModels && (
        <div id={`${id}-description`} class="coi-sr-only">
          No AI models are currently available. Please configure model providers
          in settings.
        </div>
      )}
    </div>
  );
};
