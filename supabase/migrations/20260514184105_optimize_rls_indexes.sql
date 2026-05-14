-- Optimize ownership policies by caching auth.uid() per statement.
do $$
declare
  table_name text;
begin
  alter policy "Users access own data" on public.profiles
    to authenticated
    using (id = (select auth.uid()))
    with check (id = (select auth.uid()));

  foreach table_name in array array[
    'user_subjects',
    'workspaces',
    'notes',
    'syllabus_progress',
    'internal_assessments',
    'tasks',
    'milestones',
    'resources',
    'embeddings',
    'ee_tracker',
    'tok_tracker',
    'cas_experiences'
  ] loop
    execute format(
      'alter policy "Users access own data" on public.%I to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      table_name
    );
  end loop;

  alter policy "Users access own chat messages" on public.chat_messages
    to authenticated
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));

  alter policy "Users access own flashcards" on public.flashcards
    to authenticated
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));
end $$;

-- Cover foreign keys and hot per-user access paths.
create index if not exists user_subjects_user_group_idx
  on public.user_subjects (user_id, subject_group);

create index if not exists workspaces_user_id_idx
  on public.workspaces (user_id);
create index if not exists workspaces_subject_id_idx
  on public.workspaces (subject_id);

create index if not exists notes_user_updated_idx
  on public.notes (user_id, updated_at desc);
create index if not exists notes_subject_id_idx
  on public.notes (subject_id);

create index if not exists syllabus_progress_subject_id_idx
  on public.syllabus_progress (subject_id);

create index if not exists internal_assessments_user_due_idx
  on public.internal_assessments (user_id, due_date);
create index if not exists internal_assessments_subject_id_idx
  on public.internal_assessments (subject_id);

create index if not exists tasks_user_completed_due_idx
  on public.tasks (user_id, completed, due_date);
create index if not exists tasks_subject_id_idx
  on public.tasks (subject_id);

create index if not exists milestones_user_date_idx
  on public.milestones (user_id, date);
create index if not exists milestones_subject_id_idx
  on public.milestones (subject_id);

create index if not exists resources_user_created_idx
  on public.resources (user_id, created_at desc);
create index if not exists resources_subject_id_idx
  on public.resources (subject_id);

create index if not exists embeddings_user_source_idx
  on public.embeddings (user_id, source_type, source_id);

create index if not exists ee_tracker_user_id_idx
  on public.ee_tracker (user_id);
create index if not exists tok_tracker_user_id_idx
  on public.tok_tracker (user_id);
create index if not exists cas_experiences_user_id_idx
  on public.cas_experiences (user_id);

create index if not exists flashcards_user_review_idx
  on public.flashcards (user_id, next_review);
create index if not exists flashcards_subject_id_idx
  on public.flashcards (subject_id);
create index if not exists flashcards_resource_id_idx
  on public.flashcards (resource_id);

-- Prefer HNSW for pgvector cosine search; replace the older IVFFlat baseline if present.
drop index if exists public.embeddings_embedding_idx;
create index if not exists embeddings_embedding_hnsw_idx
  on public.embeddings using hnsw (embedding vector_cosine_ops);

-- Pin function search paths and prevent broad execution of the signup trigger helper.
alter function public.handle_new_user() set search_path = public;
revoke all on function public.handle_new_user() from public;

alter function public.search_embeddings(public.vector, uuid, double precision, integer) set search_path = public;
