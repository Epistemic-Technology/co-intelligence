import { Platform } from "obsidian";

import { createToolRegistry, type ToolRegistry } from "@/agent/tool-registry";
import type { ToolDependencies, ToolPlatform } from "@/agent/types";

import { readNoteTool } from "@/agent/tools/vault/read_note";

/**
 * Returns the runtime platform tag passed to the registry's platform filter,
 * so mobile builds skip tools that aren't safe there.
 */
export function currentPlatform(): ToolPlatform {
    return Platform.isMobile ? "mobile" : "desktop";
}

/**
 * Builds the default Co-Intelligence tool registry and registers the
 * first-party tools. Called once at plugin load (`onload`). Phase 3 starts
 * with the read-only vertical slice (`read_note`); the rest of the vault and
 * web tools land in subsequent PRs (#42-#50).
 */
export function createDefaultToolRegistry(
    dependencies: ToolDependencies,
): ToolRegistry {
    const registry = createToolRegistry(dependencies);
    registry.register(readNoteTool);
    return registry;
}
