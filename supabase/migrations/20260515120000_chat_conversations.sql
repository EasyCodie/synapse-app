-- ─── Multiple Chat Conversations ─────────────────────────────────────────────

create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

alter table public.chat_conversations enable row level security;

drop policy if exists "Users access own chat conversations" on public.chat_conversations;
create policy "Users access own chat conversations" on public.chat_conversations
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.chat_conversations to authenticated;

alter table public.chat_messages
  add column if not exists conversation_id uuid references public.chat_conversations(id) on delete cascade;

-- Preserve existing single-thread history by assigning each user's previous
-- messages to one legacy conversation.
insert into public.chat_conversations (user_id, title, created_at, updated_at, last_message_at)
select
  cm.user_id,
  'Previous conversation',
  min(cm.created_at),
  max(cm.created_at),
  max(cm.created_at)
from public.chat_messages cm
where cm.conversation_id is null
group by cm.user_id;

with legacy_conversations as (
  select distinct on (user_id)
    id,
    user_id
  from public.chat_conversations
  where title = 'Previous conversation'
  order by user_id, created_at asc
)
update public.chat_messages cm
set conversation_id = lc.id
from legacy_conversations lc
where cm.conversation_id is null
  and cm.user_id = lc.user_id;

alter table public.chat_messages
  alter column conversation_id set not null;

drop policy if exists "Users access own chat messages" on public.chat_messages;
create policy "Users access own chat messages" on public.chat_messages
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.chat_messages to authenticated;

create index if not exists chat_conversations_user_recent_idx
  on public.chat_conversations (user_id, last_message_at desc);

create index if not exists chat_messages_conversation_created_idx
  on public.chat_messages (conversation_id, created_at asc);

create index if not exists chat_messages_user_conversation_idx
  on public.chat_messages (user_id, conversation_id);
