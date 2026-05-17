# src/lib Instructions

## Scope

This folder owns shared server/client utilities, AI helpers, extraction helpers, embeddings, curriculum generation, Google Drive helpers, auth helpers, and workspace generation.

## Dependency Boundaries

- Keep OpenAI SDK calls in shared server helpers or route handlers, never in browser-only components.
- Keep embedding generation centralized in `embeddings.ts`; preserve 1024-dimensional `text-embedding-3-small` embeddings unless the root instructions change.
- Keep AI tool schemas, tool implementations, and system prompt construction separated.
- Do not introduce Supabase helpers for new local-mode work.

## Extraction and Upload Helpers

- Keep accepted MIME type constants in `resource-upload.ts` as the source of truth for upload routes.
- PDF extraction must use `PDFParse.setWorker(...)` pointing at `node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs`.
- Preserve text sanitization before storage.

## Curriculum and Workspace Helpers

- Preserve IB-specific workspace generation for subjects, IA, EE, TOK, CAS, syllabus, and past-paper structures.
- Keep curriculum scaffolding idempotent where possible so repeated onboarding or repair operations do not duplicate records.

