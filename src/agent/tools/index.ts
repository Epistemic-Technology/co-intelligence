import { Platform } from "obsidian";

import { createToolRegistry, type ToolRegistry } from "@/agent/tool-registry";
import type { ToolDependencies, ToolPlatform } from "@/agent/types";

import { appendToNoteTool } from "@/agent/tools/vault/append_to_note";
import { createNoteTool } from "@/agent/tools/vault/create_note";
import { editNoteTool } from "@/agent/tools/vault/edit_note";
import { getActiveNoteTool } from "@/agent/tools/vault/get_active_note";
import { listFolderTool } from "@/agent/tools/vault/list_folder";
import { readFrontmatterTool } from "@/agent/tools/vault/read_frontmatter";
import { readNoteTool } from "@/agent/tools/vault/read_note";
import { searchVaultTool } from "@/agent/tools/vault/search_vault";
import { setFrontmatterTool } from "@/agent/tools/vault/set_frontmatter";

import { fetchUrlTool } from "@/agent/tools/web/fetch_url";
import { searchWebTool } from "@/agent/tools/web/search_web";

/**
 * Returns the runtime platform tag passed to the registry's platform filter,
 * so mobile builds skip tools that aren't safe there.
 */
export function currentPlatform(): ToolPlatform {
    return Platform.isMobile ? "mobile" : "desktop";
}

/**
 * Builds the default Co-Intelligence tool registry and registers the
 * first-party tools. Called once at plugin load (`onload`).
 *
 * Phase 3 registers: nine vault tools (vault/) and two web tools (web/).
 * `search_web` is registered even without a configured Perplexity API key
 * so the model sees the capability and the user gets a clear "not configured"
 * error if it's invoked. Hiding the tool would silently degrade to "the model
 * can't search the web" with no visible cause.
 */
export function createDefaultToolRegistry(
    dependencies: ToolDependencies,
): ToolRegistry {
    const registry = createToolRegistry(dependencies);

    registry.register(readNoteTool);
    registry.register(getActiveNoteTool);
    registry.register(listFolderTool);
    registry.register(searchVaultTool);
    registry.register(readFrontmatterTool);
    registry.register(setFrontmatterTool);
    registry.register(appendToNoteTool);
    registry.register(createNoteTool);
    registry.register(editNoteTool);

    registry.register(fetchUrlTool);
    registry.register(searchWebTool);

    return registry;
}
