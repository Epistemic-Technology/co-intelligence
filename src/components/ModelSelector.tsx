import { useContext, Accessor } from "solid-js";
import { ModelRegistry } from "@/services/model-registry";
import { PluginContext } from "@/CoiChatApp";
import { Model, ModelId } from "@/types";
import { LucideIcon } from "@/components/LucideIcon";

export interface ModelSelectorProps {
  selectedModel: Accessor<Model | null>;
  onModelChange: (model: Model | null) => void;
}

export const ModelSelector = ({
  selectedModel,
  onModelChange,
}: ModelSelectorProps) => {
  const plugin = useContext(PluginContext);
  const registry = ModelRegistry.getInstance(plugin);
  const hasModels = registry.availableModels.length > 0;

  return (
    <span>
      <LucideIcon name="bot-message-square" />
      <select
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
      >
        {hasModels ? (
          registry.availableModels.map((model) => (
            <option value={model.id}>{model.name}</option>
          ))
        ) : (
          <option value="">No Available Models</option>
        )}
      </select>
    </span>
  );
};
