import { Component, Accessor } from "solid-js";
import { ModelSelector, ModelSelectorProps } from "./ModelSelector";
import { Model } from "@/services/model-registry";

export interface UserInputProps {
  onSubmit: (value: string) => void;
  currentModel: Accessor<Model>;
  updateModel: (model: Model) => void;
}

export const UserInput: Component<UserInputProps> = ({
  onSubmit,
  currentModel,
  updateModel,
}) => {
  let textareaRef: HTMLTextAreaElement | undefined;

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey && textareaRef) {
      event.preventDefault();
      onSubmit(textareaRef.value);
      textareaRef.value = "";
    }
  };

  return (
    <div class="coi-user-input">
      <textarea ref={textareaRef} onKeyDown={handleKeyDown} rows={4} />
      <div class="coi-user-input-options">
        <ModelSelector
          selectedModel={currentModel}
          onModelChange={updateModel}
        />
      </div>
    </div>
  );
};
