import { useContext, Accessor } from "solid-js";
import { ModelRegistry, Model, ModelId } from "@/services/model-registry";
import { PluginContext } from "@/CoiChatApp";

export interface ModelSelectorProps {
  selectedModel: Accessor<Model>;
  onModelChange: (model: Model) => void;
}

export const ModelSelector = ({
  selectedModel,
  onModelChange,
}: ModelSelectorProps) => {
  const plugin = useContext(PluginContext);
  const registry = ModelRegistry.getInstance(plugin);
  return (
    <select
      value={selectedModel().id}
      onChange={(e) => {
        const model = registry.getModel(e.target.value as ModelId);
        if (model) {
          onModelChange(model);
        }
      }}
    >
      {registry.availableModels.map((model) => (
        <option value={model.id}>{model.name}</option>
      ))}
    </select>
  );
};
