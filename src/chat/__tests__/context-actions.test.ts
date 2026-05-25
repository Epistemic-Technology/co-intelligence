import { describe, it, expect } from "vitest";
import { TFile } from "obsidian";
import { addNoteToContext, addTagToContext } from "@/chat/context-actions";
import type { ContextItems } from "@/types";

function makeFile(path: string): TFile {
    const f = new TFile();
    f.path = path;
    return f;
}

describe("addNoteToContext", () => {
    it("seeds a fresh context when items is null", () => {
        const file = makeFile("a.md");
        const result = addNoteToContext(null, file);
        expect(result).toEqual({ notes: [file], tags: [], sources: [] });
    });

    it("appends a new note to an existing context", () => {
        const existing: ContextItems = {
            notes: [makeFile("a.md")],
            tags: ["#x"],
            sources: [],
        };
        const file = makeFile("b.md");
        const result = addNoteToContext(existing, file);
        expect(result.notes).toHaveLength(2);
        expect(result.notes[1]).toBe(file);
        expect(result.tags).toEqual(["#x"]);
    });

    it("returns the same items reference when the note is already linked", () => {
        const file = makeFile("a.md");
        const existing: ContextItems = {
            notes: [file],
            tags: [],
            sources: [],
        };
        expect(addNoteToContext(existing, file)).toBe(existing);
    });

    it("dedupes by path, not identity", () => {
        const existing: ContextItems = {
            notes: [makeFile("a.md")],
            tags: [],
            sources: [],
        };
        const sameByPath = makeFile("a.md");
        expect(addNoteToContext(existing, sameByPath)).toBe(existing);
    });
});

describe("addTagToContext", () => {
    it("seeds a fresh context when items is null", () => {
        const result = addTagToContext(null, "#proj");
        expect(result).toEqual({ notes: [], tags: ["#proj"], sources: [] });
    });

    it("appends a new tag to an existing context", () => {
        const existing: ContextItems = {
            notes: [],
            tags: ["#a"],
            sources: [],
        };
        const result = addTagToContext(existing, "#b");
        expect(result.tags).toEqual(["#a", "#b"]);
    });

    it("returns the same items reference when the tag is already linked", () => {
        const existing: ContextItems = {
            notes: [],
            tags: ["#dup"],
            sources: [],
        };
        expect(addTagToContext(existing, "#dup")).toBe(existing);
    });
});
