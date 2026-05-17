# Curriculum Component Instructions

## Scope

This folder owns curriculum controls and UI for EE, TOK, CAS, IA, syllabus, notes, and curriculum document workflows.

## Product Rules

- Preserve IB-specific vocabulary and structures. Do not generalize EE, TOK, CAS, IA, syllabus progress, or subject language into generic project tracking.
- Curriculum document controls must work when Google Drive is not configured; Google integration is optional.
- Do not expose Google tokens, integration row internals, or local file paths in UI copy.

## Data Rules

- Use API routes for curriculum mutations.
- Keep optimistic UI conservative for curriculum state. If a save fails, surface the failure and avoid presenting unsaved data as persisted.

