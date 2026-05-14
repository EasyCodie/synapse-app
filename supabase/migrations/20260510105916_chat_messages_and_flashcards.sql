-- ─── Chat Messages ───────────────────────────────────────────────────────────
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  sources jsonb,
  tool_calls jsonb,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_user_created
  on public.chat_messages (user_id, created_at desc);

alter table public.chat_messages enable row level security;

drop policy if exists "Users access own chat messages" on public.chat_messages;
create policy "Users access own chat messages" on public.chat_messages
  for all using (user_id = auth.uid());

-- ─── Flashcards ──────────────────────────────────────────────────────────────
create table if not exists public.flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid references public.user_subjects(id) on delete set null,
  resource_id uuid references public.resources(id) on delete set null,
  front text not null,
  back text not null,
  tags text[] not null default '{}',
  confidence integer not null default 0 check (confidence >= 0 and confidence <= 5),
  next_review timestamptz default now(),
  created_at timestamptz not null default now()
);

alter table public.flashcards enable row level security;

drop policy if exists "Users access own flashcards" on public.flashcards;
create policy "Users access own flashcards" on public.flashcards
  for all using (user_id = auth.uid());
