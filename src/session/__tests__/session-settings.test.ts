import { describe, expect, it } from "vitest";

import { createSessionStore } from "@/session/session-store";
import { createEmptySession } from "@/session/types";

describe("SessionStore.updateSettings", () => {
    it("initialises settings on first call", () => {
        const store = createSessionStore(createEmptySession("s", 0));
        store.updateSettings({ maxSteps: 7 });
        expect(store.session.settings).toEqual({ maxSteps: 7 });
    });

    it("shallow-merges later patches without dropping earlier keys", () => {
        const store = createSessionStore(createEmptySession("s", 0));
        store.updateSettings({ maxSteps: 7 });
        store.updateSettings({ approvalMode: "auto" });
        expect(store.session.settings).toEqual({
            maxSteps: 7,
            approvalMode: "auto",
        });
    });

    it("touches updatedAt so the sidecar gets re-written", () => {
        const store = createSessionStore(createEmptySession("s", 0));
        const before = store.session.updatedAt;
        store.updateSettings({ maxSteps: 5 });
        expect(store.session.updatedAt).toBeGreaterThan(before);
    });
});
