# Google Integration API Instructions

## Scope

This folder owns Google OAuth and Google Drive/Docs integration routes.

## Security Rules

- Keep Google client secrets, refresh tokens, access tokens, and token encryption keys server-side only.
- Never return token values to client components.
- Store integration state in the local `integrations` table and curriculum document links in `curriculum_documents`.
- Encrypt refresh tokens before persistence when `GOOGLE_TOKEN_ENCRYPTION_KEY` is available.

## OAuth and Scopes

- Preserve least-privilege Google scopes: Drive file access and Google Docs document edit access.
- Keep redirect URI behavior compatible with `GOOGLE_REDIRECT_URI`, `NEXT_PUBLIC_SITE_URL`, and local `http://localhost:3000` fallback.
- Validate OAuth state before exchanging codes.

## Product Fit

- Google Drive curriculum documents are optional. The core app must keep working without Google env vars or a linked Google account.
- Do not make Google Drive a required dependency for onboarding, curriculum tracking, or local workspace use.

