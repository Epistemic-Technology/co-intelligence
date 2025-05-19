import { For, Accessor } from "solid-js";
import { Source } from "@/types";

export const SourceList = ({ sources }: { sources: Accessor<Source[]> }) => {
  return (
    <div class="coi-source-list coi-context-box">
      <details>
        <summary>Sources</summary>
        <ol>
          <For each={sources()}>
            {(source) => (
              <li>
                <a href={source.url} target="_blank" rel="noopener noreferrer">
                  {source.title ?? source.url}
                </a>
              </li>
            )}
          </For>
        </ol>
      </details>
    </div>
  );
};
