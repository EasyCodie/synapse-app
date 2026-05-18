import Link from "next/link";
import { notFound } from "next/navigation";
import {
  SubjectWorkspace,
  type CurriculumDocumentItem,
  type IAItem,
} from "@/components/curriculum/curriculum-controls";
import { requireUser } from "@/lib/auth";
import { ensureCurriculumScaffold } from "@/lib/curriculum";
import { getGoogleDriveStatus } from "@/lib/google-drive";
import { createClient } from "@/lib/local/client";
import { displaySubjectName } from "@/lib/subject-display";

interface SubjectPageProps {
  params: Promise<{ subjectId: string }>;
}

type SubjectDetail = {
  id: string;
  subject_name: string;
  level: string;
  subject_group: number;
  language: string;
};

type SubjectNote = {
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

export default async function SubjectDetailPage({ params }: SubjectPageProps) {
  const { subjectId } = await params;
  const user = await requireUser();
  await ensureCurriculumScaffold(user.id);
  const local = await createClient();

  const { data: subject } = await local
    .from("user_subjects")
    .select("id, subject_name, level, subject_group, language")
    .eq("id", subjectId)
    .eq("user_id", user.id)
    .single();

  if (!subject) notFound();
  const subjectDetail = subject as SubjectDetail;

  const [notesResult, syllabusResult, iaResult, documentsResult, driveStatus] =
    await Promise.all([
      local
        .from("notes")
        .select("id, title, updated_at, folder_path")
        .eq("user_id", user.id)
        .eq("subject_id", subjectId)
        .order("updated_at", { ascending: false }),
      local
        .from("syllabus_progress")
        .select("id, topic_id, topic_title, title, completed")
        .eq("user_id", user.id)
        .eq("subject_id", subjectId),
      local
        .from("internal_assessments")
        .select("*")
        .eq("user_id", user.id)
        .eq("subject_id", subjectId)
        .single(),
      local
        .from("curriculum_documents")
        .select("*")
        .eq("user_id", user.id)
        .eq("subject_id", subjectId)
        .order("created_at", { ascending: false }),
      getGoogleDriveStatus(user.id),
    ]);
  const subjectDisplayName = displaySubjectName(subjectDetail.subject_name);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Link
              href="/subjects"
              className="text-body-sm text-ink-subtle transition-colors duration-200 hover:text-ink"
            >
              Subjects
            </Link>
            <span className="text-ink-tertiary">/</span>
            <span className="text-body-sm text-ink">{subjectDisplayName}</span>
          </div>
          <h1 className="text-headline text-ink">{subjectDisplayName}</h1>
          <div className="mt-1 flex items-center gap-2">
            <span
              className={
                subjectDetail.level === "HL"
                  ? "rounded-pill bg-primary/10 px-2 py-0.5 text-caption text-primary"
                  : "rounded-pill bg-surface-3 px-2 py-0.5 text-caption text-ink-subtle"
              }
            >
              {subjectDetail.level}
            </span>
            <span className="text-caption text-ink-subtle">
              Group {subjectDetail.subject_group}
            </span>
            <span className="text-caption text-ink-subtle">.</span>
            <span className="text-caption text-ink-subtle">
              {subjectDetail.language}
            </span>
          </div>
        </div>
      </div>

      <SubjectWorkspace
        subject={subjectDetail}
        notes={(notesResult.data ?? []) as SubjectNote[]}
        syllabus={(syllabusResult.data ?? []) as SyllabusItem[]}
        ia={iaResult.data as IAItem | null}
        documents={(documentsResult.data ?? []) as CurriculumDocumentItem[]}
        driveStatus={driveStatus}
      />
    </div>
  );
}
