# Workspace Route Instructions

## Scope

This route group owns the authenticated personal workspace: dashboard, calendar, subjects, core, IA manager, resources, search, settings, flashcards, and chat pages.

## Workspace Gating

- Preserve the guard in `layout.tsx`: workspace pages require the local personal user and completed onboarding.
- Do not add hosted login assumptions, Supabase session refresh logic, or public workspace access.
- If route behavior changes, verify the incomplete-onboarding path still redirects to `/onboarding`.

## Product Behavior

- Keep the sidebar information architecture intact: Dashboard, Calendar & Tasks, Subjects, The Core, IA Manager, Resource Library, Search, Settings.
- Subject and core programme pages must stay IB-aware. Do not flatten EE, TOK, CAS, IA, syllabus, or subject structures into generic notes.
- Search pages must represent cross-subject semantic search, not per-subject filtering only.

## UI Quality

- Use the Synapse design system before editing visual layout.
- Keep dense workspace screens scannable and operational. Avoid decorative cards, oversized hero layouts, or explanatory feature copy inside the app shell.

