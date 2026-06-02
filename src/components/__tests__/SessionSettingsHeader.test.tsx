import { describe, expect, it } from "vitest";
import { fireEvent, render } from "@solidjs/testing-library";

import { SessionSettingsHeader } from "@/components/SessionSettingsHeader";
import { createSessionStore } from "@/session/session-store";
import { createEmptySession } from "@/session/types";

function makeStore() {
    return createSessionStore(createEmptySession("s", 0));
}

describe("SessionSettingsHeader", () => {
    it("renders default values from DEFAULT_MAX_STEPS / ask mode", () => {
        const store = makeStore();
        const { container } = render(() => (
            <SessionSettingsHeader store={store} />
        ));
        expect(
            container.querySelector(".coi-session-settings-summary-values")
                ?.textContent,
        ).toContain("ask");
        expect(
            container.querySelector(".coi-session-settings-summary-values")
                ?.textContent,
        ).toContain("10 steps");
    });

    it("expanding reveals max-steps + approval-mode controls", () => {
        const store = makeStore();
        const { container, getByText } = render(() => (
            <SessionSettingsHeader store={store} />
        ));
        expect(container.querySelector(".coi-session-settings-body")).toBeNull();
        fireEvent.click(getByText("Session settings"));
        expect(
            container.querySelector(".coi-session-settings-body"),
        ).not.toBeNull();
    });

    it("changing max steps writes to the store", () => {
        const store = makeStore();
        const { getByText, container } = render(() => (
            <SessionSettingsHeader store={store} />
        ));
        fireEvent.click(getByText("Session settings"));
        const input = container.querySelector(
            "input[type='number']",
        ) as HTMLInputElement;
        fireEvent.change(input, { target: { value: "5" } });
        expect(store.session.settings?.maxSteps).toBe(5);
    });

    it("clamps max steps to the 1..50 range", () => {
        const store = makeStore();
        const { getByText, container } = render(() => (
            <SessionSettingsHeader store={store} />
        ));
        fireEvent.click(getByText("Session settings"));
        const input = container.querySelector(
            "input[type='number']",
        ) as HTMLInputElement;
        fireEvent.change(input, { target: { value: "999" } });
        expect(store.session.settings?.maxSteps).toBe(50);
        fireEvent.change(input, { target: { value: "0" } });
        expect(store.session.settings?.maxSteps).toBe(1);
    });

    it("changing approval mode writes to the store", () => {
        const store = makeStore();
        const { getByText, container } = render(() => (
            <SessionSettingsHeader store={store} />
        ));
        fireEvent.click(getByText("Session settings"));
        const select = container.querySelector(
            "select",
        ) as HTMLSelectElement;
        fireEvent.change(select, { target: { value: "auto" } });
        expect(store.session.settings?.approvalMode).toBe("auto");
    });
});
