# Chat Component Instructions

## Scope

This folder owns the chat interface and client-side chat interactions.

## Rendering Rules

- Assistant content must render Markdown with math support using the established `react-markdown`, `remark-math`, `rehype-katex`, and KaTeX CSS stack.
- Apply math rendering consistently to streaming and final assistant content.
- Do not add a custom math parser unless the user explicitly asks for one.

## Interaction Rules

- Keep chat attachment UX aligned with server constraints: PDF, DOCX, and plain text only, maximum 10MB.
- Show attachment and source states without exposing local file paths or internal storage keys.
- Preserve conversation selection/history behavior and avoid client-only state that desynchronizes from stored chat records.

## Design Rules

- Follow the Synapse design skill for spacing, controls, and typography.
- Keep the chat workspace practical and readable; do not turn it into a landing page or tutorial surface.

