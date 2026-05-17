"use client";

import type { ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import { normalizeMarkdownMath } from "@/lib/markdown-math";
import { cn } from "@/lib/utils";

const MARKDOWN_REMARK_PLUGINS = [remarkMath];
const MARKDOWN_REHYPE_PLUGINS: [[typeof rehypeKatex, { strict: "warn" }]] = [
  [rehypeKatex, { strict: "warn" }],
];

type MarkdownTone = "question" | "answer" | "compact" | "compact-muted";

interface FlashcardMarkdownProps {
  content: string;
  tone?: MarkdownTone;
  className?: string;
}

const toneClasses: Record<MarkdownTone, string> = {
  question: "text-card-title text-ink text-center leading-relaxed",
  answer: "text-body-lg text-ink text-center leading-relaxed",
  compact: "text-body-sm text-ink leading-snug",
  "compact-muted": "text-body-sm text-ink-muted leading-snug",
};

export function FlashcardMarkdown({
  content,
  tone = "question",
  className,
}: FlashcardMarkdownProps) {
  return (
    <div className={cn("flashcard-markdown max-w-full", toneClasses[tone], className)}>
      <ReactMarkdown
        remarkPlugins={MARKDOWN_REMARK_PLUGINS}
        rehypePlugins={MARKDOWN_REHYPE_PLUGINS}
        components={markdownComponents}
      >
        {normalizeMarkdownMath(content)}
      </ReactMarkdown>
    </div>
  );
}

const markdownComponents = {
  p({ children }: ComponentPropsWithoutRef<"p">) {
    return <p className="mb-2 last:mb-0">{children}</p>;
  },
  strong({ children }: ComponentPropsWithoutRef<"strong">) {
    return <strong className="font-semibold text-ink">{children}</strong>;
  },
  em({ children }: ComponentPropsWithoutRef<"em">) {
    return <em className="italic">{children}</em>;
  },
  ul({ children }: ComponentPropsWithoutRef<"ul">) {
    return <ul className="mx-auto mb-2 inline-block list-disc pl-5 text-left last:mb-0">{children}</ul>;
  },
  ol({ children }: ComponentPropsWithoutRef<"ol">) {
    return <ol className="mx-auto mb-2 inline-block list-decimal pl-5 text-left last:mb-0">{children}</ol>;
  },
  li({ children }: ComponentPropsWithoutRef<"li">) {
    return <li className="mb-1 last:mb-0">{children}</li>;
  },
  code({ children }: ComponentPropsWithoutRef<"code">) {
    return (
      <code className="rounded bg-surface-3 px-1 py-0.5 font-mono text-[0.9em] text-ink-muted">
        {children}
      </code>
    );
  },
  a({ children, href }: ComponentPropsWithoutRef<"a">) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="text-primary underline underline-offset-2"
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </a>
    );
  },
};
