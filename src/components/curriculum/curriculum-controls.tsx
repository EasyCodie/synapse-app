"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ClipboardList,
  FileText,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import {
  CAS_TYPES,
  CORE_STATUSES,
  IA_STATUSES,
  percent,
  statusLabel,
} from "@/lib/curriculum-shared";
import { cn } from "@/lib/utils";

type SubjectDetail = {
  id: string;
  subject_name: string;
  level: string;
  subject_group: number;
  language: string;
};

type NoteItem = {
  id: string;
  title: string;
  updated_at: string;
  folder_path: string;
};

type SyllabusItem = {
  id: string;
  topic_id: string;
  topic_title?: string | null;
  title?: string | null;
  completed: boolean;
};

type Milestone = {
  id: string;
  title: string;
  order?: number;
  completed?: boolean;
};

export type IAItem = {
  id: string;
  title: string | null;
  type?: string | null;
  status: string;
  due_date: string | null;
  word_count: number;
  target_word_count: number | null;
  research_question?: string | null;
  milestones?: Milestone[] | null;
  subject_id: string | null;
};

type SubjectSummary = {
  id: string;
  subject_name: string;
  level: string;
};

type EETracker = {
  id: string;
  title?: string | null;
  subject?: string | null;
  supervisor?: string | null;
  research_question?: string | null;
  status?: string | null;
  word_count?: number | null;
  milestones?: string[] | Milestone[] | null;
};

type TOKTracker = {
  id: string;
  essay_title?: string | null;
  prescribed_title?: string | null;
  exhibition_objects?: Array<{ title?: string; description?: string }> | null;
  status?: string | null;
};

export type CASExperience = {
  id: string;
  title: string;
  type: "creativity" | "activity" | "service";
  description: string | null;
  status: string;
  created_at: string;
};

const fieldClass =
  "w-full rounded-md border border-hairline bg-surface-1 px-3 py-2 text-body-sm text-ink outline-none transition-colors duration-200 placeholder:text-ink-tertiary focus:border-hairline-strong";

const buttonClass =
  "inline-flex min-h-[36px] items-center justify-center gap-2 rounded-md px-3 py-2 text-button transition-colors duration-200 disabled:pointer-events-none disabled:opacity-50";

function useMutation() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function mutate(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Update failed");
      }
    });
  }

  return { error, isPending, mutate };
}

async function requestJson(url: string, init: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Request failed");
  return body;
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
      <div
        className="h-full rounded-full bg-primary transition-all duration-200"
        style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
      />
    </div>
  );
}

function ErrorLine({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="text-caption text-ink-tertiary">{message}</p>;
}

function StatusButtons({
  statuses,
  value,
  disabled,
  onChange,
}: {
  statuses: readonly string[];
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {statuses.map((status) => (
        <button
          key={status}
          type="button"
          disabled={disabled}
          onClick={() => onChange(status)}
          className={cn(
            "rounded-md border px-2.5 py-1.5 text-caption transition-colors duration-200",
            value === status
              ? "border-primary bg-primary/10 text-primary"
              : "border-hairline bg-surface-1 text-ink-subtle hover:border-hairline-strong hover:text-ink"
          )}
        >
          {statusLabel(status)}
        </button>
      ))}
    </div>
  );
}

export function SubjectWorkspace({
  subject,
  notes,
  syllabus,
  ia,
}: {
  subject: SubjectDetail;
  notes: NoteItem[];
  syllabus: SyllabusItem[];
  ia: IAItem | null;
}) {
  const [noteTitle, setNoteTitle] = useState("");
  const { error, isPending, mutate } = useMutation();
  const completed = syllabus.filter((item) => item.completed).length;
  const syllabusPercent = percent(completed, syllabus.length);

  function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = noteTitle.trim();
    if (!title) return;
    mutate(async () => {
      await requestJson("/api/curriculum/notes", {
        method: "POST",
        body: JSON.stringify({ subject_id: subject.id, title }),
      });
      setNoteTitle("");
    });
  }

  function toggleSyllabus(item: SyllabusItem) {
    mutate(async () => {
      await requestJson("/api/curriculum/syllabus", {
        method: "PATCH",
        body: JSON.stringify({ id: item.id, completed: !item.completed }),
      });
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-6">
        <section className="rounded-lg border border-hairline bg-surface-1 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-eyebrow text-ink-tertiary">Syllabus</p>
              <h2 className="mt-1 text-card-title text-ink">
                {completed} of {syllabus.length} topics complete
              </h2>
            </div>
            <span className="text-headline text-primary">{syllabusPercent}%</span>
          </div>
          <div className="mt-4">
            <ProgressBar value={syllabusPercent} />
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-card-title text-ink">Syllabus Checklist</h2>
            <span className="text-caption text-ink-tertiary">
              Tap items to update progress
            </span>
          </div>
          {syllabus.length === 0 ? (
            <div className="rounded-lg border border-hairline bg-surface-1 p-5 text-body-sm text-ink-subtle">
              No syllabus topics are loaded for this subject yet.
            </div>
          ) : (
            <div className="space-y-2">
              {syllabus.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={isPending}
                  onClick={() => toggleSyllabus(item)}
                  className="flex w-full items-start gap-3 rounded-md border border-hairline bg-surface-1 px-4 py-3 text-left transition-colors duration-200 hover:border-hairline-strong hover:bg-surface-2"
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border",
                      item.completed
                        ? "border-primary bg-primary text-on-primary"
                        : "border-hairline-strong text-transparent"
                    )}
                  >
                    <Check className="h-3 w-3" />
                  </span>
                  <span className="min-w-0">
                    <span
                      className={cn(
                        "block text-body-sm",
                        item.completed ? "text-ink-subtle line-through" : "text-ink"
                      )}
                    >
                      {item.title ?? item.topic_id}
                    </span>
                    {item.topic_title && (
                      <span className="mt-0.5 block text-caption text-ink-tertiary">
                        {item.topic_title}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      <aside className="space-y-4">
        <section className="rounded-lg border border-hairline bg-surface-1 p-5">
          <h2 className="text-card-title text-ink">Notes</h2>
          <form onSubmit={addNote} className="mt-4 flex gap-2">
            <input
              value={noteTitle}
              onChange={(event) => setNoteTitle(event.target.value)}
              placeholder="New note title"
              className={fieldClass}
            />
            <button
              type="submit"
              disabled={isPending || !noteTitle.trim()}
              className={cn(buttonClass, "bg-primary text-on-primary hover:bg-primary-hover")}
              aria-label="Add note"
            >
              <Plus className="h-4 w-4" />
            </button>
          </form>
          <div className="mt-4 space-y-2">
            {notes.length === 0 ? (
              <p className="text-body-sm text-ink-subtle">No notes yet.</p>
            ) : (
              notes.map((note) => (
                <div
                  key={note.id}
                  className="rounded-md border border-hairline bg-surface-2 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-ink-tertiary" />
                    <p className="truncate text-body-sm text-ink">{note.title}</p>
                  </div>
                  <p className="mt-1 text-caption text-ink-tertiary">
                    {note.folder_path}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-lg border border-hairline bg-surface-1 p-5">
          <h2 className="text-card-title text-ink">Internal Assessment</h2>
          {ia ? (
            <IAQuickEditor ia={ia} compact />
          ) : (
            <p className="mt-3 text-body-sm text-ink-subtle">
              No IA tracker exists for {subject.subject_name}.
            </p>
          )}
        </section>
        <ErrorLine message={error} />
      </aside>
    </div>
  );
}

export function IAQuickEditor({ ia, compact = false }: { ia: IAItem; compact?: boolean }) {
  const { error, isPending, mutate } = useMutation();
  const [title, setTitle] = useState(ia.title ?? "");
  const [researchQuestion, setResearchQuestion] = useState(ia.research_question ?? "");
  const [wordCount, setWordCount] = useState(String(ia.word_count ?? 0));
  const [targetWordCount, setTargetWordCount] = useState(
    String(ia.target_word_count ?? "")
  );
  const [dueDate, setDueDate] = useState(ia.due_date ?? "");

  const target = Number(targetWordCount) || ia.target_word_count || 0;
  const words = Number(wordCount) || 0;

  function saveDetails() {
    mutate(async () => {
      await requestJson("/api/curriculum/ia", {
        method: "PATCH",
        body: JSON.stringify({
          id: ia.id,
          title,
          research_question: researchQuestion,
          due_date: dueDate,
          word_count: words,
          target_word_count: target,
        }),
      });
    });
  }

  function updateStatus(status: string) {
    mutate(async () => {
      await requestJson("/api/curriculum/ia", {
        method: "PATCH",
        body: JSON.stringify({ id: ia.id, status }),
      });
    });
  }

  function toggleMilestone(milestone: Milestone) {
    const milestones = (ia.milestones ?? []).map((item) =>
      item.id === milestone.id ? { ...item, completed: !item.completed } : item
    );
    mutate(async () => {
      await requestJson("/api/curriculum/ia", {
        method: "PATCH",
        body: JSON.stringify({ id: ia.id, milestones }),
      });
    });
  }

  return (
    <div className={cn("space-y-4", compact && "mt-4")}>
      <StatusButtons
        statuses={IA_STATUSES}
        value={ia.status}
        disabled={isPending}
        onChange={updateStatus}
      />

      <div className={cn("grid gap-3", compact ? "grid-cols-1" : "md:grid-cols-2")}>
        <label className="space-y-1.5">
          <span className="text-caption text-ink-subtle">Title</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-caption text-ink-subtle">Due date</span>
          <input
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            className={fieldClass}
          />
        </label>
        <label className={cn("space-y-1.5", !compact && "md:col-span-2")}>
          <span className="text-caption text-ink-subtle">Research question</span>
          <textarea
            value={researchQuestion}
            onChange={(event) => setResearchQuestion(event.target.value)}
            rows={compact ? 3 : 2}
            className={fieldClass}
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-caption text-ink-subtle">Word count</span>
          <input
            type="number"
            min={0}
            value={wordCount}
            onChange={(event) => setWordCount(event.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-caption text-ink-subtle">Target</span>
          <input
            type="number"
            min={0}
            value={targetWordCount}
            onChange={(event) => setTargetWordCount(event.target.value)}
            className={fieldClass}
          />
        </label>
      </div>

      {target > 0 && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-caption text-ink-subtle">
            <span>Draft length</span>
            <span>{words} / {target}</span>
          </div>
          <ProgressBar value={(words / target) * 100} />
        </div>
      )}

      {(ia.milestones ?? []).length > 0 && (
        <div className="space-y-2">
          <p className="text-caption text-ink-subtle">Milestones</p>
          {(ia.milestones ?? []).map((milestone) => (
            <button
              key={milestone.id}
              type="button"
              disabled={isPending}
              onClick={() => toggleMilestone(milestone)}
              className="flex w-full items-center gap-2 rounded-md border border-hairline bg-surface-2 px-3 py-2 text-left text-body-sm text-ink transition-colors duration-200 hover:border-hairline-strong"
            >
              <span
                className={cn(
                  "flex h-4 w-4 items-center justify-center rounded-sm border",
                  milestone.completed
                    ? "border-primary bg-primary text-on-primary"
                    : "border-hairline-strong"
                )}
              >
                {milestone.completed && <Check className="h-3 w-3" />}
              </span>
              {milestone.title}
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        disabled={isPending}
        onClick={saveDetails}
        className={cn(buttonClass, "bg-primary text-on-primary hover:bg-primary-hover")}
      >
        <Save className="h-4 w-4" />
        Save IA
      </button>
      <ErrorLine message={error} />
    </div>
  );
}

export function IAManagerBoard({
  ias,
  subjects,
}: {
  ias: IAItem[];
  subjects: SubjectSummary[];
}) {
  const subjectMap = new Map(subjects.map((subject) => [subject.id, subject]));
  const [selectedId, setSelectedId] = useState(ias[0]?.id ?? null);
  const selected = ias.find((ia) => ia.id === selectedId) ?? ias[0] ?? null;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {IA_STATUSES.map((status) => {
          const columnIas = ias.filter((ia) => ia.status === status);
          return (
            <section key={status} className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-eyebrow text-ink-subtle">{statusLabel(status)}</p>
                <span className="text-caption text-ink-tertiary">{columnIas.length}</span>
              </div>
              {columnIas.length === 0 ? (
                <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-hairline text-caption text-ink-tertiary">
                  Empty
                </div>
              ) : (
                columnIas.map((ia) => {
                  const subject = ia.subject_id ? subjectMap.get(ia.subject_id) : null;
                  const target = ia.target_word_count ?? 0;
                  return (
                    <button
                      key={ia.id}
                      type="button"
                      onClick={() => setSelectedId(ia.id)}
                      className={cn(
                        "w-full rounded-lg border bg-surface-1 p-4 text-left transition-colors duration-200 hover:border-hairline-strong hover:bg-surface-2",
                        selected?.id === ia.id ? "border-primary/60" : "border-hairline"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-body-sm text-ink">
                          {subject?.subject_name ?? "Unknown subject"}
                        </p>
                        <span className="rounded-sm bg-surface-3 px-1.5 py-0.5 text-caption text-ink-subtle">
                          {subject?.level ?? ""}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-caption text-ink-subtle">
                        {ia.title ?? "Untitled IA"}
                      </p>
                      {target > 0 && (
                        <div className="mt-3 space-y-1">
                          <ProgressBar value={(ia.word_count / target) * 100} />
                          <p className="text-caption text-ink-tertiary">
                            {ia.word_count}/{target} words
                          </p>
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </section>
          );
        })}
      </div>

      <aside className="rounded-lg border border-hairline bg-surface-1 p-5">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" />
          <h2 className="text-card-title text-ink">Selected IA</h2>
        </div>
        {selected ? (
          <IAQuickEditor ia={selected} compact />
        ) : (
          <p className="mt-3 text-body-sm text-ink-subtle">
            Select an IA to edit its project details.
          </p>
        )}
      </aside>
    </div>
  );
}

export function EEEditor({ ee }: { ee: EETracker }) {
  const { error, isPending, mutate } = useMutation();
  const [title, setTitle] = useState(ee.title ?? "");
  const [subject, setSubject] = useState(ee.subject ?? "");
  const [supervisor, setSupervisor] = useState(ee.supervisor ?? "");
  const [researchQuestion, setResearchQuestion] = useState(ee.research_question ?? "");
  const [wordCount, setWordCount] = useState(String(ee.word_count ?? 0));
  const milestones = normalizeEeMilestones(ee.milestones);

  function update(payload: Record<string, unknown>) {
    mutate(async () => {
      await requestJson("/api/curriculum/ee", {
        method: "PATCH",
        body: JSON.stringify({ id: ee.id, ...payload }),
      });
    });
  }

  function saveDetails() {
    update({
      title,
      subject,
      supervisor,
      research_question: researchQuestion,
      word_count: Number(wordCount) || 0,
    });
  }

  function toggleMilestone(milestone: Milestone) {
    update({
      milestones: milestones.map((item) =>
        item.id === milestone.id ? { ...item, completed: !item.completed } : item
      ),
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="rounded-lg border border-hairline bg-surface-1 p-5">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1.5 md:col-span-2">
            <span className="text-caption text-ink-subtle">Working title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={fieldClass} />
          </label>
          <label className="space-y-1.5">
            <span className="text-caption text-ink-subtle">Subject</span>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className={fieldClass} />
          </label>
          <label className="space-y-1.5">
            <span className="text-caption text-ink-subtle">Supervisor</span>
            <input value={supervisor} onChange={(e) => setSupervisor(e.target.value)} className={fieldClass} />
          </label>
          <label className="space-y-1.5 md:col-span-2">
            <span className="text-caption text-ink-subtle">Research question</span>
            <textarea value={researchQuestion} onChange={(e) => setResearchQuestion(e.target.value)} rows={3} className={fieldClass} />
          </label>
          <label className="space-y-1.5">
            <span className="text-caption text-ink-subtle">Word count</span>
            <input type="number" min={0} value={wordCount} onChange={(e) => setWordCount(e.target.value)} className={fieldClass} />
          </label>
        </div>
        <div className="mt-4 space-y-1.5">
          <div className="flex justify-between text-caption text-ink-subtle">
            <span>Essay length</span>
            <span>{Number(wordCount) || 0} / 4000</span>
          </div>
          <ProgressBar value={((Number(wordCount) || 0) / 4000) * 100} />
        </div>
        <div className="mt-4">
          <button type="button" disabled={isPending} onClick={saveDetails} className={cn(buttonClass, "bg-primary text-on-primary hover:bg-primary-hover")}>
            <Save className="h-4 w-4" />
            Save EE
          </button>
        </div>
        <ErrorLine message={error} />
      </section>

      <aside className="space-y-4 rounded-lg border border-hairline bg-surface-1 p-5">
        <h2 className="text-card-title text-ink">EE Milestones</h2>
        <StatusButtons statuses={CORE_STATUSES} value={ee.status ?? "planning"} disabled={isPending} onChange={(status) => update({ status })} />
        <div className="space-y-2">
          {milestones.map((milestone) => (
            <button key={milestone.id} type="button" disabled={isPending} onClick={() => toggleMilestone(milestone)} className="flex w-full items-center gap-2 rounded-md border border-hairline bg-surface-2 px-3 py-2 text-left text-body-sm text-ink transition-colors hover:border-hairline-strong">
              <span className={cn("flex h-4 w-4 items-center justify-center rounded-sm border", milestone.completed ? "border-primary bg-primary text-on-primary" : "border-hairline-strong")}>
                {milestone.completed && <Check className="h-3 w-3" />}
              </span>
              {milestone.title}
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}

function normalizeEeMilestones(raw: EETracker["milestones"]): Milestone[] {
  const defaults: Milestone[] = [
    { id: "proposal", title: "Research Proposal" },
    { id: "outline", title: "Essay Outline" },
    { id: "first_draft", title: "First Draft" },
    { id: "second_draft", title: "Second Draft" },
    { id: "final", title: "Final Submission" },
  ];
  if (!Array.isArray(raw) || raw.length === 0) return defaults;
  if (typeof raw[0] === "string") {
    return defaults.map((milestone) => ({
      ...milestone,
      completed: (raw as string[]).includes(milestone.id),
    }));
  }
  return raw as Milestone[];
}

export function TOKEditor({ tok }: { tok: TOKTracker }) {
  const { error, isPending, mutate } = useMutation();
  const [prescribedTitle, setPrescribedTitle] = useState(tok.prescribed_title ?? "");
  const [essayTitle, setEssayTitle] = useState(tok.essay_title ?? "");
  const [objects, setObjects] = useState(
    [0, 1, 2].map((index) => tok.exhibition_objects?.[index] ?? { title: "", description: "" })
  );

  function update(payload: Record<string, unknown>) {
    mutate(async () => {
      await requestJson("/api/curriculum/tok", {
        method: "PATCH",
        body: JSON.stringify({ id: tok.id, ...payload }),
      });
    });
  }

  function saveDetails() {
    update({
      prescribed_title: prescribedTitle,
      essay_title: essayTitle,
      exhibition_objects: objects,
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-hairline bg-surface-1 p-5">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-caption text-ink-subtle">Prescribed title</span>
            <textarea value={prescribedTitle} onChange={(e) => setPrescribedTitle(e.target.value)} rows={3} className={fieldClass} />
          </label>
          <label className="space-y-1.5">
            <span className="text-caption text-ink-subtle">Essay angle</span>
            <textarea value={essayTitle} onChange={(e) => setEssayTitle(e.target.value)} rows={3} className={fieldClass} />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <StatusButtons statuses={CORE_STATUSES} value={tok.status ?? "planning"} disabled={isPending} onChange={(status) => update({ status })} />
          <button type="button" disabled={isPending} onClick={saveDetails} className={cn(buttonClass, "bg-primary text-on-primary hover:bg-primary-hover")}>
            <Save className="h-4 w-4" />
            Save TOK
          </button>
        </div>
        <ErrorLine message={error} />
      </section>

      <section className="rounded-lg border border-hairline bg-surface-1 p-5">
        <h2 className="text-card-title text-ink">Exhibition Objects</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {objects.map((object, index) => (
            <div key={index} className="space-y-2 rounded-md border border-hairline bg-surface-2 p-3">
              <p className="text-caption text-ink-tertiary">Object {index + 1}</p>
              <input
                value={object.title ?? ""}
                onChange={(event) => setObjects((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item))}
                placeholder="Object title"
                className={fieldClass}
              />
              <textarea
                value={object.description ?? ""}
                onChange={(event) => setObjects((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item))}
                placeholder="Connection to prompt"
                rows={3}
                className={fieldClass}
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function CASEditor({ experiences }: { experiences: CASExperience[] }) {
  const { error, isPending, mutate } = useMutation();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<(typeof CAS_TYPES)[number]>("creativity");
  const [description, setDescription] = useState("");

  function createExperience(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    mutate(async () => {
      await requestJson("/api/curriculum/cas", {
        method: "POST",
        body: JSON.stringify({ title, type, description }),
      });
      setTitle("");
      setDescription("");
    });
  }

  function updateExperience(id: string, payload: Record<string, unknown>) {
    mutate(async () => {
      await requestJson("/api/curriculum/cas", {
        method: "PATCH",
        body: JSON.stringify({ id, ...payload }),
      });
    });
  }

  function deleteExperience(id: string) {
    mutate(async () => {
      const response = await fetch(`/api/curriculum/cas?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Could not delete CAS experience");
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
      <form onSubmit={createExperience} className="space-y-3 rounded-lg border border-hairline bg-surface-1 p-5">
        <h2 className="text-card-title text-ink">New Experience</h2>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Experience title" className={fieldClass} />
        <select value={type} onChange={(e) => setType(e.target.value as (typeof CAS_TYPES)[number])} className={fieldClass}>
          {CAS_TYPES.map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}
        </select>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Reflection or evidence notes" rows={4} className={fieldClass} />
        <button type="submit" disabled={isPending || !title.trim()} className={cn(buttonClass, "bg-primary text-on-primary hover:bg-primary-hover")}>
          <Plus className="h-4 w-4" />
          Add CAS
        </button>
        <ErrorLine message={error} />
      </form>

      <div className="space-y-2">
        {experiences.length === 0 ? (
          <div className="rounded-lg border border-hairline bg-surface-1 p-5 text-body-sm text-ink-subtle">
            No CAS experiences yet.
          </div>
        ) : (
          experiences.map((experience) => (
            <div key={experience.id} className="rounded-lg border border-hairline bg-surface-1 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-body text-ink">{experience.title}</p>
                  <p className="text-caption text-ink-subtle">{statusLabel(experience.type)}</p>
                </div>
                <div className="flex gap-2">
                  {["planned", "in_progress", "complete"].map((status) => (
                    <button
                      key={status}
                      type="button"
                      disabled={isPending}
                      onClick={() => updateExperience(experience.id, { status })}
                      className={cn(
                        "rounded-md border px-2 py-1 text-caption transition-colors",
                        experience.status === status
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-hairline text-ink-subtle hover:border-hairline-strong"
                      )}
                    >
                      {statusLabel(status)}
                    </button>
                  ))}
                  <button type="button" disabled={isPending} onClick={() => deleteExperience(experience.id)} className="rounded-md border border-hairline p-2 text-ink-tertiary transition-colors hover:border-hairline-strong hover:text-ink">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {experience.description && (
                <p className="mt-3 text-body-sm text-ink-subtle">{experience.description}</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
