# src/app Instructions

## Scope

This folder owns Next.js App Router pages, layouts, loading states, error states, and route handlers.

## App Router Rules

- Follow App Router conventions: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, and `route.ts`.
- Keep server-only work in route handlers or server helpers. Do not move vector search, file extraction, token exchange, OpenAI calls, or local database writes into client components.
- Use `NextResponse.json` for JSON route responses unless an existing stream or `Response` pattern is already required.
- Authenticate route handlers with `createClient()` from `@/lib/local/client` before reading or writing user-scoped records.
- Keep redirects aligned with personal mode: incomplete onboarding sends workspace users to `/onboarding`; completed onboarding opens the workspace directly.

## UI Rules

- Before changing UI in this tree, read `C:\synapse\.agents\skills\synapse-design\SKILL.md`.
- Keep loading and error states present for workspace-facing routes.
- Do not add marketing-style landing pages in place of the actual workspace experience.

