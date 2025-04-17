import { Plugin, WorkspaceLeaf, ItemView, MarkdownView } from "obsidian";
import HelloWorld from "./ui/HelloWorld";
import { render } from "solid-js/web";
import "./styles.css";

const VIEW_TYPE = "solid-hello-view";

export default class SolidHelloPlugin extends Plugin {
  async onload() {
    this.registerView(VIEW_TYPE, (leaf) => new SolidHelloView(leaf));

    // Add a left‑ribbon icon that opens the view
    const ribbon = this.addRibbonIcon("rocket", "Open Solid Hello", () =>
      this.activateView(),
    );
    ribbon.addClass("solid-hello-ribbon");

    // Command palette entry
    this.addCommand({
      id: "open-solid-hello",
      name: "Open Solid Hello World",
      callback: () => this.activateView(),
    });
  }

  onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }

  async activateView() {
    const { workspace } = this.app;
    let leaf: WorkspaceLeaf | null = workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) leaf = workspace.getRightLeaf(false);
    if (!leaf) return;
    await leaf.setViewState({ type: VIEW_TYPE, active: true });
    workspace.revealLeaf(leaf);
  }
}

class SolidHelloView extends ItemView {
  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType() {
    return VIEW_TYPE;
  }
  getDisplayText() {
    return "Solid Hello";
  }

  async onOpen() {
    render(() => <HelloWorld />, this.containerEl);
  }

  async onClose() {
    // Solid cleans up automatically when the container is removed.
  }
}
