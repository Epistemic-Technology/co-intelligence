import { Source } from "@/services/model-service";

export const SourceList = ({ sources }: { sources: Source[] }) => {
  return (
    <div>
      <ol>
        {sources.map((source) => (
          <li>
            <a href={source.url} target="_blank" rel="noopener noreferrer">
              {source.title ?? source.url}
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
};
