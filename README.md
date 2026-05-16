# Synapse

Synapse is a personal IB study workspace built with Next.js. It now runs without a hosted database or external auth provider: profile, subjects, tasks, resources, flashcards, chat history, and embeddings are stored locally under `.synapse-data/`.

## Local Development

Use `pnpm.cmd` on Windows:

```bash
pnpm.cmd install
pnpm.cmd dev
```

Open `http://localhost:3000`. The app routes directly into the personal workspace. If onboarding has not been completed, `/dashboard` redirects to `/onboarding`.

## Local Data

Runtime data is intentionally not committed:

- `.synapse-data/db.json` stores app records.
- `.synapse-data/uploads/` stores uploaded resource files.
- Deleting `.synapse-data/` resets the personal workspace.

## Verification

```bash
node_modules\.bin\tsc.cmd --noEmit
pnpm.cmd run lint
pnpm.cmd test
pnpm.cmd run build
pnpm.cmd test:e2e
```
