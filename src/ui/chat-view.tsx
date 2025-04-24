import { ItemView, WorkspaceLeaf } from "obsidian";
import { render } from "solid-js/web";

import { HelloWorld } from "./hello-world";

export const VIEW_TYPE_COI_CHAT = "coi-chat-view";

export class ChatView extends ItemView {
  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_COI_CHAT;
  }

  getDisplayText(): string {
    return "Co-Intelligence Chat";
  }

  async onOpen() {
    const rootElement = this.containerEl.children[1];
    render(() => <HelloWorld />, rootElement);
  }
}
