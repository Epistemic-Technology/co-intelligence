import "obsidian";

declare module "obsidian" {
  interface MetadataCache {
    getTags(): Record<string, number>;
  }
}
