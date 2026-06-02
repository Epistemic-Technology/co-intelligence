import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@solidjs/testing-library";

import { ProcessingIndicator } from "@/components/ProcessingIndicator";

describe("ProcessingIndicator", () => {
    it("omits the step badge while idle (step 0)", () => {
        const { container } = render(() => (
            <ProcessingIndicator
                currentStep={() => 0}
                maxSteps={() => 10}
            />
        ));
        expect(
            container.querySelector(".coi-processing-step-badge"),
        ).toBeNull();
    });

    it("renders the Step N / M badge while running", () => {
        const { container } = render(() => (
            <ProcessingIndicator
                currentStep={() => 3}
                maxSteps={() => 10}
            />
        ));
        expect(
            container.querySelector(".coi-processing-step-badge")?.textContent,
        ).toBe("Step 3 / 10");
    });

    it("Cancel button fires the onCancel callback", () => {
        const onCancel = vi.fn();
        const { getByText } = render(() => (
            <ProcessingIndicator onCancel={onCancel} />
        ));
        fireEvent.click(getByText("Cancel"));
        expect(onCancel).toHaveBeenCalled();
    });

    it("works without step accessors (back-compat)", () => {
        const { container } = render(() => <ProcessingIndicator />);
        expect(
            container.querySelector(".coi-processing-step-badge"),
        ).toBeNull();
    });
});
