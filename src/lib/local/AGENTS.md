# Local Client Instructions

## Scope

This folder owns the local Supabase-compatible client facade and local persistence layer.

## Persistence Rules

- `.synapse-data/db.json` is the source of truth for local records.
- `.synapse-data/uploads/` is the source of truth for uploaded files.
- Do not change storage paths, table names, or record shapes casually. Route handlers and UI pages depend on this facade behaving like the subset of Supabase used by the app.
- Preserve the single personal user behavior unless the user explicitly asks for real multi-user auth.

## Safety Rules

- Keep writes serialized through the existing write queue pattern.
- Keep malformed database recovery behavior: back up malformed JSON, then recreate the minimum usable local DB.
- Preserve upload path normalization and traversal protection.
- Avoid destructive migration behavior. If a schema change is needed, add backward-compatible defaults and recovery logic.

## API Compatibility

- Maintain compatibility for `auth`, `from`, `rpc`, and `storage` methods already used by the app.
- `search_embeddings` must continue to perform local cosine similarity and return resource/note/IA matches in a shape expected by search and chat.

