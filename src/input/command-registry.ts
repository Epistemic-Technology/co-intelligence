/**
 * Slash-command registry. Mirrors the tool-registry shape: append-only,
 * lookup by name, generic over a per-application HOST type so individual
 * commands can pull whatever wiring they need (model accessors, store
 * actions, controllers) off a single context object.
 */

export interface CommandContext<HOST = unknown> {
    /** Raw text after the command name, trimmed. Empty string if absent. */
    args: string;
    host: HOST;
}

export interface Command<HOST = unknown> {
    name: string;
    description: string;
    /** Hint string for the palette (e.g. `<id>`, `on|off`). */
    parameterHint?: string;
    run(ctx: CommandContext<HOST>): void | Promise<void>;
}

export interface CommandRegistry<HOST = unknown> {
    register(command: Command<HOST>): void;
    has(name: string): boolean;
    get(name: string): Command<HOST> | undefined;
    list(): Command<HOST>[];
}

/**
 * Append-only command registry. Re-registering an existing name throws, same
 * as the tool registry — surfaces accidental collisions early.
 */
export function createCommandRegistry<HOST = unknown>(): CommandRegistry<HOST> {
    const commands = new Map<string, Command<HOST>>();
    return {
        register(command) {
            if (commands.has(command.name)) {
                throw new Error(
                    `Command "${command.name}" is already registered`,
                );
            }
            commands.set(command.name, command);
        },
        has: (name) => commands.has(name),
        get: (name) => commands.get(name),
        list: () => Array.from(commands.values()),
    };
}

export interface ParsedCommand {
    name: string;
    args: string;
}

/**
 * Parses a slash-command line into `{ name, args }`. Returns null when `line`
 * isn't a command (no leading `/` or only whitespace after it). The leading
 * `/` is stripped from the name. Trailing whitespace around args is trimmed.
 *
 * Examples:
 *   parseCommandLine("/clear")           → { name: "clear", args: "" }
 *   parseCommandLine("/model gpt-4")     → { name: "model", args: "gpt-4" }
 *   parseCommandLine("/system  path  ")  → { name: "system", args: "path" }
 *   parseCommandLine("hello")            → null
 *   parseCommandLine("/")                → null
 */
export function parseCommandLine(line: string): ParsedCommand | null {
    if (!line.startsWith("/")) return null;
    const rest = line.slice(1).trimStart();
    if (rest === "") return null;
    const spaceIdx = rest.indexOf(" ");
    if (spaceIdx === -1) {
        return { name: rest, args: "" };
    }
    return {
        name: rest.slice(0, spaceIdx),
        args: rest.slice(spaceIdx + 1).trim(),
    };
}
