import { describe, expect, it } from "vitest";
import { App } from "obsidian";

import { builtInCommands } from "@/input/commands";
import type { ChatCommandHost } from "@/input/commands";
import type CoIntelligencePlugin from "@/CoIntelligencePlugin";
import { createSessionStore } from "@/session/session-store";
import { createEmptySession } from "@/session/types";
import type { Model } from "@/types";
import type { ModelRegistry } from "@/services/model-registry";

const model: Model = {
    id: "openai:gpt-4-turbo",
    provider: "openai",
    name: "GPT-4 Turbo",
    renaming: false,
    toggleWebSearch: true,
    streaming: true,
};

function findCommand(name: string) {
    const cmd = builtInCommands.find((c) => c.name === name);
    if (!cmd) throw new Error(`No built-in command "${name}"`);
    return cmd;
}

function makeHost(overrides: Partial<ChatCommandHost> = {}): ChatCommandHost {
    const store = createSessionStore(createEmptySession("s1", 0));
    store.appendUserMessage("hi");
    let currentModel: Model | null = null;
    let currentPrompt = "initial.md";
    let currentWeb = false;
    return {
        app: new App(),
        plugin: {} as CoIntelligencePlugin,
        store,
        modelRegistry: {
            availableModels: [model],
        } as ModelRegistry,
        model: {
            current: () => currentModel,
            set: (m) => {
                currentModel = m;
            },
        },
        systemPrompt: {
            current: () => currentPrompt,
            set: (p) => {
                currentPrompt = p;
            },
        },
        webSearch: {
            current: () => currentWeb,
            set: (v) => {
                currentWeb = v;
            },
        },
        ...overrides,
    };
}

describe("/clear", () => {
    it("empties the session messages but keeps the id", () => {
        const host = makeHost();
        const id = host.store.session.id;
        findCommand("clear").run({ args: "", host });
        expect(host.store.session.messages).toEqual([]);
        expect(host.store.session.id).toBe(id);
    });
});

describe("/model", () => {
    it("doesn't change the model when called with no arg", () => {
        const host = makeHost();
        findCommand("model").run({ args: "", host });
        expect(host.model.current()).toBeNull();
    });

    it("sets the model when args uniquely match", () => {
        const host = makeHost();
        findCommand("model").run({ args: "gpt-4", host });
        expect(host.model.current()).toBe(model);
    });

    it("doesn't set the model when args don't match", () => {
        const host = makeHost();
        findCommand("model").run({ args: "nonexistent", host });
        expect(host.model.current()).toBeNull();
    });
});

describe("/system", () => {
    it("sets the system prompt path", () => {
        const host = makeHost();
        findCommand("system").run({ args: "Prompts/Foo.md", host });
        expect(host.systemPrompt.current()).toBe("Prompts/Foo.md");
    });

    it("clears the system prompt when called with no arg", () => {
        const host = makeHost();
        findCommand("system").run({ args: "", host });
        expect(host.systemPrompt.current()).toBe("");
    });
});

describe("/web", () => {
    it("sets explicit on/off", () => {
        const host = makeHost();
        findCommand("web").run({ args: "on", host });
        expect(host.webSearch.current()).toBe(true);
        findCommand("web").run({ args: "off", host });
        expect(host.webSearch.current()).toBe(false);
    });

    it("toggles when no recognised arg is given", () => {
        const host = makeHost();
        findCommand("web").run({ args: "", host });
        expect(host.webSearch.current()).toBe(true);
        findCommand("web").run({ args: "", host });
        expect(host.webSearch.current()).toBe(false);
    });
});

describe("stub commands", () => {
    it("/approve, /checkpoint, /agent run without throwing", () => {
        const host = makeHost();
        expect(() =>
            findCommand("approve").run({ args: "auto", host }),
        ).not.toThrow();
        expect(() =>
            findCommand("checkpoint").run({ args: "", host }),
        ).not.toThrow();
        expect(() =>
            findCommand("agent").run({ args: "on", host }),
        ).not.toThrow();
    });
});

