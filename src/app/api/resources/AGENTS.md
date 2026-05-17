# Resource API Instructions

## Scope

This folder owns Resource Library upload, deletion, reindexing, and resource metadata routes.

## Upload Rules

- Resource Library uploads accept only PDF, DOCX, PPTX, plain text, and Markdown.
- Preserve the 50MB Resource Library size limit.
- Keep MIME validation, filename sanitization, text extraction, and indexing status decisions server-side.
- Store original files under local storage using `RESOURCE_BUCKET`; do not write uploads outside `.synapse-data/uploads/`.

## Extraction and Indexing

- Use shared helpers from `@/lib/resource-upload`.
- PDF extraction must keep using `@/lib/extract-pdf`, which configures `PDFParse.setWorker(...)` with the real `pdfjs-dist` worker path.
- Do not switch to `pdf-parse/worker`.
- Keep indexing status accurate: queued/indexing/indexed/failed/not_started must reflect the actual embedding lifecycle.

## Failure Handling

- Clean up stored files if metadata insertion fails.
- Resource deletion must remove user-owned metadata, embeddings, and uploaded file objects consistently.
- Reindexing must remain user-scoped and must not index another user's records, even in personal mode.

