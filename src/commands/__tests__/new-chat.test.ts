import { describe, it, expect, vi, beforeEach } from "vitest";
import { NewChatCommand } from "../new-chat";
import type CoIntelligencePlugin from "@/CoIntelligencePlugin";
import type { App } from "obsidian";

vi.mock("@/utils/notes", () => ({
  createCOINote: vi.fn(),
}));

describe("NewChatCommand", () => {
  let app: App;
  let plugin: CoIntelligencePlugin;
  let command: NewChatCommand;

  beforeEach(() => {
    app = {} as App;
    plugin = { app } as CoIntelligencePlugin;
    command = new NewChatCommand(plugin);
  });

  it("should have correct id and name", () => {
    expect(command.id).toBe("new-chat");
    expect(command.name).toBe("New chat");
  });

  it("should call createCOINote when callback is executed", async () => {
    const { createCOINote } = await import("@/utils/notes");
    const mockedCreateCOINote = vi.mocked(createCOINote);

    await command.callback();

    expect(mockedCreateCOINote).toHaveBeenCalledWith(app, plugin);
    expect(mockedCreateCOINote).toHaveBeenCalledTimes(1);
  });

  it("should store app and plugin references", () => {
    expect(command["app"]).toBe(app);
    expect(command["plugin"]).toBe(plugin);
  });
});