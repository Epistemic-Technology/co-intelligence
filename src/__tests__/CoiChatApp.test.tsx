import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import {
  CoiChatApp,
  PluginContext,
  AppContext,
  FileContext,
} from "../CoiChatApp";
import type { App, TFile } from "obsidian";
import type CoIntelligencePlugin from "@/CoIntelligencePlugin";
import type { ModelChatMessage, ContextItems, Source } from "@/types";
import { useContext } from "solid-js";

vi.mock("@/components/ChatInterface", () => ({
  ChatInterface: (props: any) => {
    // Test component that verifies props and context
    const plugin = useContext(PluginContext);
    const app = useContext(AppContext);
    const file = useContext(FileContext);

    return (
      <div data-testid="chat-interface">
        <div data-testid="initial-messages">
          {JSON.stringify(props.initialMessages)}
        </div>
        <div data-testid="initial-context">
          {JSON.stringify(props.initialContext)}
        </div>
        <div data-testid="initial-sources">
          {JSON.stringify(props.initialSources)}
        </div>
        <div data-testid="has-plugin">{plugin ? "true" : "false"}</div>
        <div data-testid="has-app">{app ? "true" : "false"}</div>
        <div data-testid="has-file">{file ? "true" : "false"}</div>
        <button
          onClick={() =>
            props.onChange({
              newMessages: [{ role: "user", content: "test" }],
              newTitle: "Test Title",
              contextItems: null,
              lastModelId: "test-model",
            })
          }
        >
          Trigger Change
        </button>
      </div>
    );
  },
}));

describe("CoiChatApp", () => {
  let app: App;
  let file: TFile;
  let plugin: CoIntelligencePlugin;
  let onChange: vi.Mock;
  let initialMessages: ModelChatMessage[];
  let initialContext: ContextItems;
  let initialSources: Source[];

  beforeEach(() => {
    app = { name: "MockApp" } as App;
    file = { path: "test.md", basename: "test" } as TFile;
    plugin = { name: "MockPlugin" } as CoIntelligencePlugin;
    onChange = vi.fn();
    initialMessages = [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there!" },
    ];
    initialContext = {
      notes: ["note1.md"],
      tags: ["#tag1"],
      sources: [],
    };
    initialSources = [{ title: "Source 1", url: "https://example.com" }];
  });

  it("should render ChatInterface with correct props", () => {
    render(() => (
      <CoiChatApp
        app={app}
        file={file}
        plugin={plugin}
        onChange={onChange}
        initialMessages={initialMessages}
        initialContext={initialContext}
        initialSources={initialSources}
      />
    ));

    expect(screen.getByTestId("chat-interface")).toBeInTheDocument();
    expect(screen.getByTestId("initial-messages").textContent).toBe(
      JSON.stringify(initialMessages),
    );
    expect(screen.getByTestId("initial-context").textContent).toBe(
      JSON.stringify(initialContext),
    );
    expect(screen.getByTestId("initial-sources").textContent).toBe(
      JSON.stringify(initialSources),
    );
  });

  it("should provide contexts to child components", () => {
    render(() => (
      <CoiChatApp
        app={app}
        file={file}
        plugin={plugin}
        onChange={onChange}
        initialMessages={initialMessages}
        initialContext={initialContext}
      />
    ));

    expect(screen.getByTestId("has-plugin").textContent).toBe("true");
    expect(screen.getByTestId("has-app").textContent).toBe("true");
    expect(screen.getByTestId("has-file").textContent).toBe("true");
  });

  it("should pass onChange callback to ChatInterface", () => {
    render(() => (
      <CoiChatApp
        app={app}
        file={file}
        plugin={plugin}
        onChange={onChange}
        initialMessages={initialMessages}
        initialContext={initialContext}
      />
    ));

    const button = screen.getByText("Trigger Change");
    button.click();

    expect(onChange).toHaveBeenCalledWith({
      newMessages: [{ role: "user", content: "test" }],
      newTitle: "Test Title",
      contextItems: null,
      lastModelId: "test-model",
    });
  });

  it("should handle undefined initialSources with default value", () => {
    render(() => (
      <CoiChatApp
        app={app}
        file={file}
        plugin={plugin}
        onChange={onChange}
        initialMessages={initialMessages}
        initialContext={initialContext}
      />
    ));

    expect(screen.getByTestId("initial-sources").textContent).toBe(
      JSON.stringify([]),
    );
  });

  it("should wrap content in coi-app div", () => {
    render(() => (
      <CoiChatApp
        app={app}
        file={file}
        plugin={plugin}
        onChange={onChange}
        initialMessages={initialMessages}
        initialContext={initialContext}
      />
    ));

    const wrapper = screen.getByTestId("chat-interface").parentElement;
    expect(wrapper).toHaveClass("coi-app");
  });

  it("should handle empty initial messages", () => {
    render(() => (
      <CoiChatApp
        app={app}
        file={file}
        plugin={plugin}
        onChange={onChange}
        initialMessages={[]}
        initialContext={initialContext}
      />
    ));

    expect(screen.getByTestId("initial-messages").textContent).toBe("[]");
  });

  it("should handle complex context items", () => {
    const complexContext: ContextItems = {
      notes: ["note1.md", "note2.md", "folder/note3.md"],
      tags: ["#tag1", "#tag2", "#nested/tag"],
      sources: ["https://source1.com", "https://source2.com"],
    };

    render(() => (
      <CoiChatApp
        app={app}
        file={file}
        plugin={plugin}
        onChange={onChange}
        initialMessages={initialMessages}
        initialContext={complexContext}
      />
    ));

    expect(screen.getByTestId("initial-context").textContent).toBe(
      JSON.stringify(complexContext),
    );
  });
});
