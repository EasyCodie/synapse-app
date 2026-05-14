create temporary table subject_dedupe on commit drop as
with ranked_subjects as (
  select
    id as duplicate_id,
    first_value(id) over (
      partition by user_id, lower(subject_name)
      order by created_at, id
    ) as canonical_id,
    row_number() over (
      partition by user_id, lower(subject_name)
      order by created_at, id
    ) as duplicate_rank
  from public.user_subjects
)
select duplicate_id, canonical_id
from ranked_subjects
where duplicate_rank > 1;

-- Generated workspaces are safe to collapse with their duplicate subject rows.
delete from public.workspaces w
using subject_dedupe d
where w.subject_id = d.duplicate_id;

-- Preserve user-created records that may point at duplicate subject rows.
update public.notes n
set subject_id = d.canonical_id
from subject_dedupe d
where n.subject_id = d.duplicate_id;

update public.internal_assessments ia
set subject_id = d.canonical_id
from subject_dedupe d
where ia.subject_id = d.duplicate_id;

update public.tasks t
set subject_id = d.canonical_id
from subject_dedupe d
where t.subject_id = d.duplicate_id;

update public.milestones m
set subject_id = d.canonical_id
from subject_dedupe d
where m.subject_id = d.duplicate_id;

update public.resources r
set subject_id = d.canonical_id
from subject_dedupe d
where r.subject_id = d.duplicate_id;

update public.flashcards f
set subject_id = d.canonical_id
from subject_dedupe d
where f.subject_id = d.duplicate_id;

-- Avoid unique conflicts when duplicate syllabus checklist rows exist.
delete from public.syllabus_progress sp
using subject_dedupe d
where sp.subject_id = d.duplicate_id
  and exists (
    select 1
    from public.syllabus_progress existing
    where existing.user_id = sp.user_id
      and existing.subject_id = d.canonical_id
      and existing.topic_id = sp.topic_id
  );

update public.syllabus_progress sp
set subject_id = d.canonical_id
from subject_dedupe d
where sp.subject_id = d.duplicate_id;

-- Remove duplicate subject records after references have been remapped.
delete from public.user_subjects us
using subject_dedupe d
where us.id = d.duplicate_id;

-- Collapse any remaining duplicate workspace rows for the same subject.
with ranked_workspaces as (
  select
    id,
    row_number() over (
      partition by user_id, subject_id
      order by created_at, id
    ) as workspace_rank
  from public.workspaces
  where subject_id is not null
)
delete from public.workspaces w
using ranked_workspaces rw
where w.id = rw.id
  and rw.workspace_rank > 1;

alter table public.user_subjects
  add constraint user_subjects_user_subject_name_unique
  unique (user_id, subject_name);

create unique index if not exists user_subjects_user_subject_name_lower_unique
  on public.user_subjects (user_id, lower(subject_name));

alter table public.workspaces
  add constraint workspaces_user_subject_unique
  unique (user_id, subject_id);

create or replace function public.enforce_max_six_subjects()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT'
    or (tg_op = 'UPDATE' and new.user_id is distinct from old.user_id) then
    if (
      select count(*)
      from public.user_subjects
      where user_id = new.user_id
        and id <> new.id
    ) >= 6 then
      raise exception 'A workspace can only contain 6 subjects.' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_max_six_subjects_trigger on public.user_subjects;
create trigger enforce_max_six_subjects_trigger
  before insert or update of user_id on public.user_subjects
  for each row execute function public.enforce_max_six_subjects();

revoke all on function public.enforce_max_six_subjects() from public;
revoke execute on function public.enforce_max_six_subjects() from anon;
revoke execute on function public.enforce_max_six_subjects() from authenticated;
