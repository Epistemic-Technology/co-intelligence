import { describe, it, expect, vi, beforeEach } from "vitest";
import { App, TFile } from "obsidian";
import { loadSystemPrompt } from "@/chat/system-prompt-loader";

describe("loadSystemPrompt", () => {
    let app: App;

    beforeEach(() => {
        app = new App();
    });

    it("returns undefined when path is undefined", async () => {
        const result = await loadSystemPrompt(undefined, app);
        expect(result).toBeUndefined();
        expect(app.vault.getAbstractFileByPath).not.toHaveBeenCalled();
    });

    it("returns undefined when path is empty string", async () => {
        const result = await loadSystemPrompt("", app);
        expect(result).toBeUndefined();
        expect(app.vault.getAbstractFileByPath).not.toHaveBeenCalled();
    });

    it("returns undefined when path is whitespace", async () => {
        const result = await loadSystemPrompt("   ", app);
        expect(result).toBeUndefined();
        expect(app.vault.getAbstractFileByPath).not.toHaveBeenCalled();
    });

    it("returns undefined when file does not exist", async () => {
        vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(null);
        const result = await loadSystemPrompt("missing.md", app);
        expect(result).toBeUndefined();
        expect(app.vault.read).not.toHaveBeenCalled();
    });

    it("returns undefined when the path resolves to a non-TFile", async () => {
        vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue({
            path: "some-folder",
        } as never);
        const result = await loadSystemPrompt("some-folder", app);
        expect(result).toBeUndefined();
        expect(app.vault.read).not.toHaveBeenCalled();
    });

    it("returns the file contents when the file exists", async () => {
        const file = new TFile();
        file.path = "prompt.md";
        vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(file);
        vi.mocked(app.vault.read).mockResolvedValue("You are a helpful agent.");

        const result = await loadSystemPrompt("prompt.md", app);

        expect(result).toBe("You are a helpful agent.");
        expect(app.vault.getAbstractFileByPath).toHaveBeenCalledWith(
            "prompt.md",
        );
        expect(app.vault.read).toHaveBeenCalledWith(file);
    });

    it("propagates read errors to the caller", async () => {
        const file = new TFile();
        vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(file);
        vi.mocked(app.vault.read).mockRejectedValue(new Error("disk error"));

        await expect(loadSystemPrompt("prompt.md", app)).rejects.toThrow(
            "disk error",
        );
    });
});
