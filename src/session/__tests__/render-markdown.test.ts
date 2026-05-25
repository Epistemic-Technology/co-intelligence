import { describe, it, expect } from "vitest";
import {
    renderChatSection,
    renderSessionIntoNote,
} from "@/session/render-markdown";
import { createEmptySession, type Session } from "@/session/types";

function withMessage(
    session: Session,
    role: "user" | "assistant",
    parts: Session["messages"][number]["parts"],
): Session {
    return {
        ...session,
        messages: [
            ...session.messages,
            { id: `m${session.messages.length}`, role, createdAt: 0, parts },
        ],
    };
}

describe("renderChatSection", () => {
    it("renders an empty session with just the markers", () => {
        const session = createEmptySession("s1", 0);
        const md = renderChatSection(session);
        expect(md).toBe(
            "<!-- CHAT-THREAD-START -->\n\n<!-- CHAT-THREAD-END -->",
        );
    });

    it("renders text parts under role headers", () => {
        let session = createEmptySession("s1", 0);
        session = withMessage(session, "user", [
            { type: "text", text: "hello" },
        ]);
        session = withMessage(session, "assistant", [
            { type: "text", text: "hi there" },
        ]);
        const md = renderChatSection(session);
        expect(md).toContain("## user:\n\nhello");
        expect(md).toContain("## assistant:\n\nhi there");
    });

    it("bumps user-content headers so role headers stay top-level", () => {
        let session = createEmptySession("s1", 0);
        session = withMessage(session, "user", [
            { type: "text", text: "# title\n\nbody" },
        ]);
        const md = renderChatSection(session);
        // Top-level `# title` becomes `### title` so `## user:` outranks it.
        expect(md).toContain("### title");
    });

    it("renders tool-call parts as collapsed info callouts with JSON args", () => {
        let session = createEmptySession("s1", 0);
        session = withMessage(session, "assistant", [
            {
                type: "tool-call",
                toolCallId: "c1",
                toolName: "read_note",
                input: { path: "a.md" },
                status: "success",
            },
        ]);
        const md = renderChatSection(session);
        expect(md).toContain("> [!info]- tool-call: read_note (success)");
        expect(md).toContain('"path": "a.md"');
    });

    it("renders successful tool-results as success callouts", () => {
        let session = createEmptySession("s1", 0);
        session = withMessage(session, "assistant", [
            {
                type: "tool-result",
                toolCallId: "c1",
                toolName: "read_note",
                output: "file contents",
            },
        ]);
        const md = renderChatSection(session);
        expect(md).toContain("> [!success]- tool-result: read_note");
        expect(md).toContain('> "file contents"');
    });

    it("renders failed tool-results as error callouts", () => {
        let session = createEmptySession("s1", 0);
        session = withMessage(session, "assistant", [
            {
                type: "tool-result",
                toolCallId: "c1",
                toolName: "edit_note",
                output: "permission denied",
                isError: true,
            },
        ]);
        const md = renderChatSection(session);
        expect(md).toContain("> [!error]- tool-result: edit_note");
    });

    it("renders reasoning parts wrapped in <think> tags", () => {
        let session = createEmptySession("s1", 0);
        session = withMessage(session, "assistant", [
            { type: "reasoning", text: "let me think about this" },
            { type: "text", text: "the answer is 42" },
        ]);
        const md = renderChatSection(session);
        expect(md).toContain("<think>\nlet me think about this\n</think>");
        expect(md).toContain("the answer is 42");
    });

    it("renders attachment parts as note callouts", () => {
        let session = createEmptySession("s1", 0);
        session = withMessage(session, "user", [
            {
                type: "attachment",
                id: "a1",
                mimeType: "image/png",
                name: "screenshot",
            },
        ]);
        const md = renderChatSection(session);
        expect(md).toContain("> [!note]- attachment: screenshot");
        expect(md).toContain("image/png");
    });

    it("renders sources as a numbered markdown list under ## Sources", () => {
        const session: Session = {
            ...createEmptySession("s1", 0),
            sources: [
                { url: "https://a.example", title: "A" },
                { url: "https://b.example", title: "B" },
            ],
        };
        const md = renderChatSection(session);
        expect(md).toContain("## Sources");
        expect(md).toContain("1. [A](https://a.example)");
        expect(md).toContain("2. [B](https://b.example)");
    });

    it("omits the Sources section when there are no sources", () => {
        const session = createEmptySession("s1", 0);
        const md = renderChatSection(session);
        expect(md).not.toContain("## Sources");
    });

    it("skips system messages", () => {
        let session = createEmptySession("s1", 0);
        session = withMessage(session, "user", [
            { type: "text", text: "hi" },
        ]);
        session.messages.unshift({
            id: "sys",
            role: "system",
            createdAt: 0,
            parts: [{ type: "text", text: "system prompt" }],
        });
        const md = renderChatSection(session);
        expect(md).not.toContain("system");
        expect(md).toContain("## user:");
    });
});

describe("renderSessionIntoNote", () => {
    it("splices the rendered section between existing markers", () => {
        const note = [
            "# My Chat",
            "",
            "<!-- CHAT-THREAD-START -->",
            "old stuff",
            "<!-- CHAT-THREAD-END -->",
            "",
            "footer",
        ].join("\n");
        let session = createEmptySession("s1", 0);
        session = withMessage(session, "user", [
            { type: "text", text: "hello" },
        ]);
        const result = renderSessionIntoNote(note, session);
        expect(result.startsWith("# My Chat")).toBe(true);
        expect(result.endsWith("footer")).toBe(true);
        expect(result).toContain("## user:\n\nhello");
        expect(result).not.toContain("old stuff");
    });

    it("returns the note unchanged when markers are missing", () => {
        const note = "no markers here";
        const session = createEmptySession("s1", 0);
        expect(renderSessionIntoNote(note, session)).toBe(note);
    });

    it("preserves frontmatter and footer", () => {
        const note = [
            "---",
            "is-coi-chat: true",
            "---",
            "<!-- CHAT-THREAD-START -->",
            "",
            "<!-- CHAT-THREAD-END -->",
        ].join("\n");
        const session = createEmptySession("s1", 0);
        const result = renderSessionIntoNote(note, session);
        expect(result.startsWith("---\nis-coi-chat: true\n---\n")).toBe(true);
    });
});
