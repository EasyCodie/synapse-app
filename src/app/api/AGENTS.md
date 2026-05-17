# API Route Instructions

## Scope

This folder owns local-mode backend behavior through Next.js Route Handlers.

## Safety Rules

- Every user-scoped route must call `createClient()` and `local.auth.getUser()` before reading or writing records.
- Validate request bodies at the route boundary. Prefer existing Zod schemas or narrow runtime checks over trusting client input.
- Keep server-side-only concerns here: OpenAI calls, embedding generation, file validation, extraction, token exchange, and local persistence.
- Never leak stack traces, API keys, OAuth tokens, refresh tokens, or local file paths in JSON responses.
- Return stable error shapes with appropriate status codes.

## Data Rules

- Use `@/lib/local/client`; do not import from `@/lib/supabase/*`.
- Keep all writes user-scoped with `user.id`.
- When a route mutates related records, preserve existing cleanup and status transitions. For example, failed resource metadata writes must clean up uploaded files, and failed embedding writes must mark indexing failure.

