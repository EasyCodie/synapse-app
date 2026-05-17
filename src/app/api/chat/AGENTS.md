# Chat API Instructions

## Scope

This folder owns AI Advisor chat routes, chat history, conversations, and chat attachments.

## AI Boundaries

- Use the OpenAI SDK for model calls. Keep the default chat model wired through `OPENAI_CHAT_MODEL`, falling back to the project default.
- The AI Advisor must answer from the student's local Synapse data and attached resources. Do not add open-web retrieval unless the user explicitly asks for it.
- Preserve tool schemas in `@/lib/ai-tool-schemas` and tool implementations in `@/lib/ai-tools`; keep route code focused on orchestration.
- Keep system prompt construction in `@/lib/ai-system-prompt`.

## Chat Data Rules

- Store conversations and messages through the local client tables.
- User messages, assistant messages, tool results, and source metadata must remain associated with the authenticated local user.
- Attachment resource IDs must be parsed defensively, de-duplicated, capped, and checked against resources accessible to `user.id`.

## Attachment Rules

- Chat attachments are limited to PDF, DOCX, and plain text.
- Preserve the 10MB chat attachment maximum unless the root instructions change.
- Keep extraction and MIME validation server-side.

