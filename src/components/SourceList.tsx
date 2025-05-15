import { Source } from "@/services/model-service";
import { For } from "solid-js";

export const SourceList = ({ sources }: { sources: Source[] }) => {
  return (
    <div class="coi-source-list coi-context-box">
      <h4>Sources</h4>
      <ol>
        <For each={sources}>
          {(source) => (
            <li>
              <a href={source.url} target="_blank" rel="noopener noreferrer">
                {source.title ?? source.url}
              </a>
            </li>
          )}
        </For>
      </ol>
    </div>
  );
};
