# synapse-app Instructions

## Scope

These instructions apply to the Next.js application under `C:\synapse\synapse-app`.

## Non-Negotiables

- Keep Synapse in personal local mode. Do not add Supabase clients, migrations, hosted auth flows, Edge Functions, or hosted storage unless the user explicitly asks to restore a hosted backend.
- Treat `.synapse-data/` as runtime state. Do not delete, reset, or rewrite it as part of a code change unless the user explicitly asks for a workspace reset.
- Run commands from this directory. Use `pnpm.cmd` on Windows.
- After code changes, run `pnpm.cmd build` and `pnpm.cmd lint` before reporting completion.
- Never expose `OPENAI_API_KEY`, Google OAuth secrets, refresh tokens, or access tokens to client components or logs.

## Architecture Defaults

- Use `src/lib/local/client.ts` for app data access.
- Keep API routes as the boundary for server-side validation, embeddings, AI calls, file handling, and token handling.
- Keep App Router files under `src/app`; do not create a root-level `app` directory.
- Preserve TypeScript strictness and existing import aliases.

