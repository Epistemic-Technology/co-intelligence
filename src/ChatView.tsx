import {
    WorkspaceLeaf,
    App,
    TFile,
    TextFileView,
    Menu,
    Notice,
} from "obsidian";
import { render } from "solid-js/web";

import { CoiChatApp } from "@/CoiChatApp";
import { CoIntelligencePlugin } from "@/CoIntelligencePlugin";
import { renameNote, isActiveCoiNote } from "@/utils/notes";
import { generateChatTitle } from "@/services/model-service";
import { ensureSessionForNote } from "@/session/migration";
import { renderSessionIntoNote } from "@/session/render-markdown";
import { readSession, writeSession } from "@/session/session-storage";
import type { SessionStore } from "@/session/session-store";
import { createEmptySession, messageText } from "@/session/types";
import "@/types-extended";

export const VIEW_TYPE_COI_CHAT = "coi-chat-view";

const SAVE_DEBOUNCE_MS = 500;

export class ChatView extends TextFileView {
    public plugin: CoIntelligencePlugin;
    public app: App;
    public file: TFile | null;
    public rootElement: Element | null = null;
    public dispose: (() => void) | null = null;
    public sessionId: string | null = null;

    private saveTimeout: number | null = null;

    constructor(leaf: WorkspaceLeaf, plugin: CoIntelligencePlugin, app: App) {
        super(leaf);
        this.plugin = plugin;
        this.app = app;
        this.file = app.workspace.getActiveFile();
        this.icon = "bot-message-square";
    }

    getViewType(): string {
        return VIEW_TYPE_COI_CHAT;
    }

    getDisplayText(): string {
        return this.file?.basename || "Co-Intelligence Chat";
    }

    getViewData(): string {
        return this.data;
    }

    /**
     * Obsidian calls this when the file content is set externally (initial
     * open, external edit, sync). We just stash the raw text — the session
     * load and Solid render are driven by onLoadFile/onOpen.
     */
    setViewData(data: string, clear: boolean): void {
        this.data = data;
        if (clear) {
            this.clear();
        }
    }

    clear(): void {
        if (this.dispose) {
            this.dispose();
            this.dispose = null;
        }
        this.sessionId = null;
    }

    async onLoadFile(file: TFile): Promise<void> {
        this.file = file;
        await this.loadAndRender(file);
    }

    onUnloadFile(_file: TFile): Promise<void> {
        this.clear();
        return Promise.resolve();
    }

    async onOpen(): Promise<void> {
        if (!this.file) return;
        if (!isActiveCoiNote(this.file, this.app)) return;
        await this.loadAndRender(this.file);
    }

    async refresh(): Promise<void> {
        this.clear();
        await this.onOpen();
    }

    private async loadAndRender(file: TFile): Promise<void> {
        const sessionId = await ensureSessionForNote(
            file,
            this.app,
            this.plugin,
        );
        if (!sessionId) return;
        this.sessionId = sessionId;

        const session =
            (await readSession(sessionId, this.app, this.plugin)) ??
            createEmptySession(sessionId);

        this.renderApp(file, session);
    }

    private renderApp(
        file: TFile,
        session: import("@/session/types").Session,
    ): void {
        this.rootElement = this.rootElement || this.containerEl.children[1];
        if (!this.rootElement) {
            new Notice("Error: root element is null");
            console.error("Root element is null");
            return;
        }
        this.dispose = render(
            () => (
                <CoiChatApp
                    app={this.app}
                    plugin={this.plugin}
                    file={file}
                    initialSession={session}
                    onSessionChange={(store) => this.debounceSave(store)}
                    onAssistantResponseComplete={() =>
                        void this.regenerateTitle()
                    }
                />
            ),
            this.rootElement,
        );
    }

    private debounceSave(store: SessionStore): void {
        if (this.saveTimeout !== null) {
            window.clearTimeout(this.saveTimeout);
        }
        this.saveTimeout = window.setTimeout(() => {
            this.saveTimeout = null;
            void this.persistSession(store);
        }, SAVE_DEBOUNCE_MS);
    }

    private async persistSession(store: SessionStore): Promise<void> {
        if (!this.file) return;
        try {
            await writeSession(store.session, this.app, this.plugin);
            const currentNoteContent = await this.app.vault.cachedRead(
                this.file,
            );
            const updatedNoteContent = renderSessionIntoNote(
                currentNoteContent,
                store.session,
            );
            this.data = updatedNoteContent;
            this.requestSave();
        } catch (error) {
            new Notice(`Error saving session: ${String(error)}`);
            console.error("Error saving session:", error);
        }
    }

    private async regenerateTitle(): Promise<void> {
        if (!this.file) return;
        if (!this.sessionId) return;
        try {
            const session = await readSession(
                this.sessionId,
                this.app,
                this.plugin,
            );
            if (!session) return;
            const titleMessages = session.messages
                .filter((m) => m.role === "user" || m.role === "assistant")
                .map((m) => ({
                    role: m.role as "user" | "assistant",
                    content: messageText(m),
                }));
            const newTitle = await generateChatTitle(
                titleMessages,
                this.plugin,
            );
            if (newTitle && newTitle !== this.file.basename) {
                await renameNote(this.file, newTitle, this.app, this.plugin);
            }
        } catch (error) {
            console.error("Error regenerating chat title:", error);
        }
    }

    onPaneMenu(menu: Menu, source: string): void {
        menu.addItem((item) => {
            item.setTitle("View as Markdown")
                .setIcon("bot-message-square")
                .onClick(() => {
                    this.app.commands.executeCommandById(
                        "co-intelligence:toggle-chat-view",
                    );
                });
        });
        super.onPaneMenu(menu, source);
    }
}
