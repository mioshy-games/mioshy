"use client";

// components/articles/ArticleContent.tsx
//
// Renders Markdown with beautiful, professional typography.
// Does NOT require @tailwindcss/typography - all styles are explicit Tailwind classes.

import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";

const components: Components = {
  // ── Headings ──────────────────────────────────────────────────────────────
  // The page template already renders the single <h1> (the article title).
  // A markdown-level-1 heading in the body would emit a SECOND <h1> and dilute
  // the on-page signal, so render it as an <h2> (kept visually large).
  h1: ({ children }) => (
    <h2 className="mt-10 mb-4 text-3xl font-bold tracking-tight text-gray-900 leading-tight first:mt-0">
      {children}
    </h2>
  ),
  h2: ({ children }) => (
    <h2 className="mt-10 mb-4 text-2xl font-bold text-gray-900 leading-snug border-s-4 border-rose-400 ps-4 first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-8 mb-3 text-xl font-bold text-gray-800 leading-snug">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-6 mb-2 text-lg font-semibold text-gray-800">
      {children}
    </h4>
  ),

  // ── Paragraph ─────────────────────────────────────────────────────────────
  // Body is 20px per the article template spec (Itzik 2026-07-06).
  p: ({ children }) => (
    <p className="my-5 text-[1.25rem] leading-[1.75] text-gray-800">
      {children}
    </p>
  ),

  // ── Lists ─────────────────────────────────────────────────────────────────
  ul: ({ children }) => (
    <ul className="my-5 ms-5 space-y-2 list-none">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-5 ms-5 space-y-2 list-decimal marker:text-rose-400 marker:font-semibold">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="flex gap-2 text-[1.25rem] leading-[1.75] text-gray-800 before:content-['•'] before:text-rose-400 before:font-bold before:shrink-0 before:mt-0.5">
      <span>{children}</span>
    </li>
  ),

  // ── Blockquote (pull quote) ────────────────────────────────────────────────
  blockquote: ({ children }) => (
    <blockquote className="my-8 border-s-4 border-rose-400 bg-rose-50 rounded-e-2xl px-6 py-4">
      <div className="text-[1.0625rem] leading-relaxed text-gray-700 italic [&>p]:my-0">
        {children}
      </div>
    </blockquote>
  ),

  // ── Inline elements ────────────────────────────────────────────────────────
  // A markdown link with the title "cta" (i.e. `[text](url "cta")`) renders as
  // a full brand button — the article's primary conversion CTA. Everything else
  // is a normal inline text link.
  a: ({ href, children, title }) =>
    title === "cta" || title === "button" ? (
      <a
        href={href}
        className="my-4 inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#7c3aed] to-[#db2777] px-8 py-4 text-lg font-bold text-white no-underline shadow-lg transition hover:opacity-90"
      >
        {children}
      </a>
    ) : (
      <a
        href={href}
        className="font-medium text-rose-600 underline underline-offset-2 decoration-rose-300 hover:text-rose-700 hover:decoration-rose-500 transition-colors"
      >
        {children}
      </a>
    ),
  strong: ({ children }) => (
    <strong className="font-bold text-gray-900">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-gray-700">{children}</em>
  ),

  // ── Code ──────────────────────────────────────────────────────────────────
  code: ({ children, className }) => {
    // Block code (inside pre) vs inline code
    const isBlock = className?.startsWith("language-");
    if (isBlock) {
      return (
        <code className="block text-sm font-mono text-gray-800 leading-relaxed">
          {children}
        </code>
      );
    }
    return (
      <code className="rounded-md bg-rose-50 px-1.5 py-0.5 text-[0.875em] font-mono text-rose-600">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-6 overflow-x-auto rounded-2xl bg-gray-900 px-6 py-5 text-sm text-gray-100 leading-relaxed shadow-lg">
      {children}
    </pre>
  ),

  // ── HR ─────────────────────────────────────────────────────────────────────
  hr: () => (
    <hr className="my-10 border-none h-px bg-gradient-to-r from-transparent via-rose-200 to-transparent" />
  ),

  // ── Image ─────────────────────────────────────────────────────────────────
  img: ({ src, alt }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt ?? ""}
      className="my-8 w-full rounded-2xl shadow-md object-cover"
      loading="lazy"
    />
  ),

  // ── Table ─────────────────────────────────────────────────────────────────
  table: ({ children }) => (
    <div className="my-8 overflow-x-auto rounded-2xl border border-gray-200 shadow-sm">
      <table className="w-full text-sm text-left">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-gray-50 text-gray-600 uppercase text-xs tracking-wider">
      {children}
    </thead>
  ),
  tbody: ({ children }) => (
    <tbody className="divide-y divide-gray-100">{children}</tbody>
  ),
  tr: ({ children }) => <tr className="hover:bg-gray-50 transition-colors">{children}</tr>,
  th: ({ children }) => (
    <th className="px-4 py-3 font-semibold text-gray-700">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-4 py-3 text-gray-700">{children}</td>
  ),
};

interface ArticleContentProps {
  content: string;
  isRtl?: boolean;
}

export function ArticleContent({ content, isRtl = false }: ArticleContentProps) {
  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className="text-gray-700"
    >
      <ReactMarkdown components={components}>{content}</ReactMarkdown>
    </div>
  );
}
