# Resource Component Instructions

## Scope

This folder owns Resource Library upload, delete, and reindex UI.

## UX and Safety Rules

- Mirror server constraints without treating client checks as authoritative: PDF, DOCX, PPTX, TXT, and Markdown only; 50MB maximum.
- Keep upload, delete, and reindex actions explicit and stateful. Show pending and failure states.
- Do not expose raw local upload paths in the UI.
- Deletion and reindex controls must call the existing API routes instead of mutating local data directly.

## Product Rules

- Resource Library items feed semantic search and AI Advisor context. Do not remove extraction, indexing status, or reindex affordances from the workflow.
- Warnings such as no extracted text should remain visible enough for the user to understand why search or chat may not use a file.

