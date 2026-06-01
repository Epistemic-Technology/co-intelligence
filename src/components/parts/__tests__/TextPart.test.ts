import { describe, expect, it } from "vitest";

import { splitThinkBlock } from "@/components/parts/TextPart";

describe("splitThinkBlock", () => {
    it("treats plain text as a single body", () => {
        expect(splitThinkBlock("hello world")).toEqual({
            reasoning: "",
            reasoningOpen: false,
            body: "hello world",
        });
    });

    it("extracts a closed reasoning block from the start", () => {
        expect(splitThinkBlock("<think>why?</think>answer")).toEqual({
            reasoning: "why?",
            reasoningOpen: false,
            body: "answer",
        });
    });

    it("marks reasoning open while the model is still streaming the block", () => {
        expect(splitThinkBlock("intro <think>still thinking")).toEqual({
            reasoning: "still thinking",
            reasoningOpen: true,
            body: "intro ",
        });
    });

    it("rejoins prefix + suffix when the block sits in the middle", () => {
        const split = splitThinkBlock("before <think>aside</think> after");
        expect(split.reasoning).toBe("aside");
        expect(split.body).toBe("before  after");
    });
});
