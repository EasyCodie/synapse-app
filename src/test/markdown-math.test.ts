import { describe, expect, it } from "vitest";
import { normalizeMarkdownMath } from "@/lib/markdown-math";

describe("normalizeMarkdownMath", () => {
  it("converts LaTeX display delimiters for remark-math", () => {
    expect(normalizeMarkdownMath("\\[ e^{2y}=x^3+y \\]")).toBe("$$ e^{2y}=x^3+y $$");
  });

  it("converts LaTeX inline delimiters for remark-math", () => {
    expect(normalizeMarkdownMath("Solve for \\(\\frac{dy}{dx}\\).")).toBe("Solve for $\\frac{dy}{dx}$.");
  });

  it("leaves unmatched delimiters unchanged while streaming", () => {
    expect(normalizeMarkdownMath("Start \\[ e^{2y}")).toBe("Start \\[ e^{2y}");
  });

  it("does not convert delimiters inside inline code", () => {
    expect(normalizeMarkdownMath("Use `\\(x\\)` literally, then \\(y\\).")).toBe(
      "Use `\\(x\\)` literally, then $y$."
    );
  });

  it("does not convert delimiters inside fenced code", () => {
    expect(normalizeMarkdownMath("```tex\n\\[x\\]\n```\n\\[y\\]")).toBe("```tex\n\\[x\\]\n```\n$$y$$");
  });
});
