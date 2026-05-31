import { Notice, type App } from "obsidian";

import type { CoIntelligencePlugin } from "@/CoIntelligencePlugin";
import type { ModelRegistry } from "@/services/model-registry";
import type { SessionStore } from "@/session/session-store";
import { createEmptySession } from "@/session/types";
import type { Model } from "@/types";

import type { Command } from "@/input/command-registry";

/**
 * Per-invocation context built by the chat UI when running a slash command.
 * Commands operate against this so the registry stays decoupled from the
 * per-chat signals scattered across `ChatInterface`.
 */
export interface ChatCommandHost {
    app: App;
    plugin: CoIntelligencePlugin;
    store: SessionStore;
    modelRegistry: ModelRegistry;
    model: {
        current: () => Model | null;
        set: (m: Model | null) => void;
    };
    systemPrompt: {
        current: () => string;
        set: (path: string) => void;
    };
    webSearch: {
        current: () => boolean;
        set: (v: boolean) => void;
    };
}

const stub = (label: string, plannedPhase: string) =>
    new Notice(`${label}: coming in ${plannedPhase}`);

/**
 * Built-in slash commands. Real commands (`/clear`, `/model`, `/system`,
 * `/web`) act against the host immediately. Commands whose backing
 * functionality lands in a later phase (`/approve`, `/checkpoint`, `/agent`)
 * are registered as stubs so the palette can advertise them — invoking one
 * just fires an Obsidian Notice naming the phase that owns it.
 */
export const builtInCommands: Command<ChatCommandHost>[] = [
    {
        name: "clear",
        description: "Clear the current chat",
        run({ host }) {
            host.store.replaceSession(createEmptySession(host.store.session.id));
        },
    },
    {
        name: "model",
        description: "Switch the active model",
        parameterHint: "<id>",
        run({ args, host }) {
            if (!args) {
                new Notice("Usage: /model <model-id>");
                return;
            }
            const matches = host.modelRegistry.availableModels.filter((m) =>
                m.id.toLowerCase().includes(args.toLowerCase()),
            );
            if (matches.length === 0) {
                new Notice(`No model matches "${args}"`);
                return;
            }
            if (matches.length > 1) {
                new Notice(
                    `Ambiguous: ${matches.map((m) => m.id).join(", ")}`,
                );
                return;
            }
            host.model.set(matches[0]);
            new Notice(`Model set to ${matches[0].name}`);
        },
    },
    {
        name: "system",
        description: "Set the system-prompt note path",
        parameterHint: "<path>",
        run({ args, host }) {
            host.systemPrompt.set(args);
            new Notice(
                args
                    ? `System prompt set to ${args}`
                    : "System prompt cleared",
            );
        },
    },
    {
        name: "web",
        description: "Toggle provider-native web search",
        parameterHint: "on|off",
        run({ args, host }) {
            const arg = args.toLowerCase();
            const next =
                arg === "on" || arg === "true" || arg === "1"
                    ? true
                    : arg === "off" || arg === "false" || arg === "0"
                      ? false
                      : !host.webSearch.current();
            host.webSearch.set(next);
            new Notice(`Web search ${next ? "on" : "off"}`);
        },
    },
    {
        name: "approve",
        description: "Approval mode (stub — Phase 5)",
        parameterHint: "auto|ask|readonly",
        run() {
            stub("/approve", "Phase 5");
        },
    },
    {
        name: "checkpoint",
        description: "Snapshot the session (stub — Phase 6)",
        run() {
            stub("/checkpoint", "Phase 6");
        },
    },
    {
        name: "agent",
        description: "Toggle agent tools (stub — Phase 6)",
        parameterHint: "on|off",
        run() {
            stub("/agent", "Phase 6");
        },
    },
];

/**
 * Returns true if `name` is one of the built-in command names. Useful for the
 * slash trigger when deciding whether to suppress a literal `/` insertion.
 */
export function isBuiltInCommand(name: string): boolean {
    return builtInCommands.some((c) => c.name === name);
}
