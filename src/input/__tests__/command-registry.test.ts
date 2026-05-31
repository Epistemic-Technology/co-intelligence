import { describe, expect, it, vi } from "vitest";

import {
    createCommandRegistry,
    parseCommandLine,
    type Command,
} from "@/input/command-registry";

describe("createCommandRegistry", () => {
    it("starts empty", () => {
        const r = createCommandRegistry();
        expect(r.list()).toEqual([]);
        expect(r.has("anything")).toBe(false);
    });

    it("registers and looks up by name", () => {
        const r = createCommandRegistry();
        const cmd: Command = {
            name: "clear",
            description: "Clear chat",
            run: vi.fn(),
        };
        r.register(cmd);
        expect(r.has("clear")).toBe(true);
        expect(r.get("clear")).toBe(cmd);
        expect(r.list()).toEqual([cmd]);
    });

    it("throws on duplicate registration", () => {
        const r = createCommandRegistry();
        r.register({ name: "x", description: "", run: vi.fn() });
        expect(() =>
            r.register({ name: "x", description: "", run: vi.fn() }),
        ).toThrow(/already registered/);
    });

    it("invokes run with the parsed context", async () => {
        const r = createCommandRegistry<{ value: number }>();
        const run = vi.fn();
        r.register({ name: "x", description: "", run });
        await r.get("x")?.run({ args: "hello", host: { value: 1 } });
        expect(run).toHaveBeenCalledWith({
            args: "hello",
            host: { value: 1 },
        });
    });
});

describe("parseCommandLine", () => {
    it("returns name + empty args for bare commands", () => {
        expect(parseCommandLine("/clear")).toEqual({
            name: "clear",
            args: "",
        });
    });

    it("splits name from args on the first space", () => {
        expect(parseCommandLine("/model gpt-4")).toEqual({
            name: "model",
            args: "gpt-4",
        });
    });

    it("trims surrounding whitespace from args", () => {
        expect(parseCommandLine("/system  some path  ")).toEqual({
            name: "system",
            args: "some path",
        });
    });

    it("returns null when the line is not a command", () => {
        expect(parseCommandLine("hello")).toBeNull();
    });

    it("returns null for a bare slash", () => {
        expect(parseCommandLine("/")).toBeNull();
        expect(parseCommandLine("/   ")).toBeNull();
    });
});
