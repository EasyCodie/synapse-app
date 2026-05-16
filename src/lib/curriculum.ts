import iaRequirements from "@/data/ib-ia-requirements.json";
export { CAS_TYPES, CORE_STATUSES, IA_STATUSES, percent, statusLabel } from "@/lib/curriculum-shared";
import { createClient } from "@/lib/local/client";

type WorkspaceStructure = {
  subjectId?: string;
  subjectName?: string;
  iaConfig?: {
    type?: string;
    targetWordCount?: number;
    milestones?: Array<{ id: string; title: string; order?: number }>;
  } | null;
  syllabusTopics?: Array<{
    id: string;
    title: string;
    subtopics: string[];
  }>;
};

type WorkspaceRow = {
  subject_id: string | null;
  structure: WorkspaceStructure;
};

type SubjectRow = {
  id: string;
  subject_name: string;
  subject_key?: string | null;
};

type IaRequirements = Record<
  string,
  {
    name: string;
    type: string;
    targetWordCount: number;
    milestones: Array<{ id: string; title: string; order: number }>;
  }
>;

const iaData = iaRequirements as IaRequirements;

export async function ensureCurriculumScaffold(userId: string) {
  const local = await createClient();

  const [subjectsResult, workspacesResult, eeResult, tokResult] = await Promise.all([
    local
      .from("user_subjects")
      .select("id, subject_name, subject_key")
      .eq("user_id", userId),
    local
      .from("workspaces")
      .select("subject_id, structure")
      .eq("user_id", userId),
    local.from("ee_tracker").select("id").eq("user_id", userId).maybeSingle(),
    local.from("tok_tracker").select("id").eq("user_id", userId).maybeSingle(),
  ]);

  const subjects = (subjectsResult.data ?? []) as SubjectRow[];
  const workspaces = (workspacesResult.data ?? []) as WorkspaceRow[];
  const workspaceBySubjectId = new Map(
    workspaces
      .filter((workspace) => workspace.subject_id)
      .map((workspace) => [workspace.subject_id!, workspace.structure])
  );

  const syllabusRows: Array<Record<string, unknown>> = [];
  const iaRows: Array<Record<string, unknown>> = [];

  for (const subject of subjects) {
    const workspace = workspaceBySubjectId.get(subject.id);
    const subjectKey = subject.subject_key ?? workspace?.subjectId ?? null;

    for (const topic of workspace?.syllabusTopics ?? []) {
      topic.subtopics.forEach((subtopic, index) => {
        syllabusRows.push({
          user_id: userId,
          subject_id: subject.id,
          topic_id: `${topic.id}-${index}`,
          topic_title: topic.title,
          title: subtopic,
          completed: false,
          order_index: syllabusRows.length,
        });
      });
    }

    const iaConfig = workspace?.iaConfig ?? (subjectKey ? iaData[subjectKey] : null);
    if (iaConfig) {
      iaRows.push({
        user_id: userId,
        subject_id: subject.id,
        title: `${subject.subject_name} IA`,
        type: iaConfig.type ?? "Internal Assessment",
        status: "not_started",
        word_count: 0,
        target_word_count: iaConfig.targetWordCount ?? null,
        research_question: "",
        milestones: (iaConfig.milestones ?? []).map((milestone) => ({
          ...milestone,
          completed: false,
        })),
      });
    }
  }

  if (syllabusRows.length > 0) {
    await local
      .from("syllabus_progress")
      .upsert(syllabusRows, { onConflict: "user_id,subject_id,topic_id" });
  }

  if (iaRows.length > 0) {
    await local
      .from("internal_assessments")
      .upsert(iaRows, { onConflict: "user_id,subject_id" });
  }

  if (!eeResult.data) {
    await local.from("ee_tracker").insert({
      user_id: userId,
      title: "",
      subject: "",
      supervisor: "",
      research_question: "",
      status: "planning",
      word_count: 0,
      milestones: [],
    });
  }

  if (!tokResult.data) {
    await local.from("tok_tracker").insert({
      user_id: userId,
      essay_title: "",
      prescribed_title: "",
      exhibition_objects: [],
      status: "planning",
    });
  }
}
