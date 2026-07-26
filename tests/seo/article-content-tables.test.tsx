import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ArticleContent } from "@/components/articles/ArticleContent";

// Regression guard: react-markdown v10 needs remark-gfm for GFM tables. Without
// it, `| a | b |` renders as literal pipe text instead of a <table>. These
// filler articles are table-heavy, so lock the behavior in.
describe("ArticleContent GFM tables", () => {
  const md = ["| ממד | תיאור |", "|---|---|", "| תקשורת | האם מדברים |"].join("\n");

  it("renders markdown tables as a real <table> (styled)", () => {
    const html = renderToStaticMarkup(<ArticleContent content={md} isRtl />);
    expect(html).toContain("<table");
    expect(html).toContain("<thead");
    expect(html).toContain("תקשורת");
    // literal pipe should NOT survive as body text
    expect(html).not.toContain("| ממד |");
  });

  it("still renders the brand CTA button for [text](url \"cta\")", () => {
    const html = renderToStaticMarkup(
      <ArticleContent content={'[התחילו](/he/couples-assessment "cta")'} isRtl />,
    );
    expect(html).toContain('href="/he/couples-assessment"');
    expect(html).toContain("from-[#7c3aed]");
  });
});
