import iaRequirements from "@/data/ib-ia-requirements.json";
import syllabusTopics from "@/data/ib-syllabus-topics.json";

export interface SubjectSelection {
  id: string;
  name: string;
  group: number;
  level: "HL" | "SL";
  language: string;
}

export interface WorkspaceFolder {
  id: string;
  name: string;
  type: "folder" | "checklist" | "tracker" | "notes";
  children?: WorkspaceFolder[];
  items?: WorkspaceItem[];
}

export interface WorkspaceItem {
  id: string;
  title: string;
  completed?: boolean;
  order?: number;
}

export interface GeneratedWorkspace {
  subjectId: string;
  subjectName: string;
  level: "HL" | "SL";
  folders: WorkspaceFolder[];
  iaConfig: {
    type: string;
    targetWordCount: number;
    milestones: WorkspaceItem[];
  } | null;
  syllabusTopics: Array<{
    id: string;
    title: string;
    subtopics: string[];
  }>;
}

type IaRequirements = Record<
  string,
  {
    name: string;
    type: string;
    targetWordCount: number;
    maxWordCount: number;
    components: string[];
    milestones: Array<{ id: string; title: string; order: number }>;
  }
>;

type SyllabusTopics = Record<
  string,
  {
    topics: Array<{
      id: string;
      title: string;
      subtopics: string[];
    }>;
  }
>;

const iaData = iaRequirements as IaRequirements;
const syllabusData = syllabusTopics as SyllabusTopics;

export function generateWorkspace(subject: SubjectSelection): GeneratedWorkspace {
  const subjectKey = subject.id;

  // IA configuration
  const iaConfig = iaData[subjectKey]
    ? {
        type: iaData[subjectKey]!.type,
        targetWordCount: iaData[subjectKey]!.targetWordCount,
        milestones: iaData[subjectKey]!.milestones.map((m) => ({
          id: m.id,
          title: m.title,
          completed: false,
          order: m.order,
        })),
      }
    : null;

  // Syllabus topics
  const topics = syllabusData[subjectKey]?.topics ?? [];

  // Folder structure
  const folders: WorkspaceFolder[] = [
    {
      id: `${subjectKey}-notes`,
      name: "Notes",
      type: "folder",
      children: topics.map((topic) => ({
        id: `${subjectKey}-notes-${topic.id}`,
        name: topic.title,
        type: "notes" as const,
      })),
    },
    {
      id: `${subjectKey}-syllabus`,
      name: "Syllabus Checklist",
      type: "checklist",
      items: topics.flatMap((topic) =>
        topic.subtopics.map((subtopic, idx) => ({
          id: `${topic.id}-${idx}`,
          title: `${topic.title}: ${subtopic}`,
          completed: false,
        }))
      ),
    },
    {
      id: `${subjectKey}-past-papers`,
      name: "Past Papers",
      type: "tracker",
      items: [],
    },
    ...(iaConfig
      ? [
          {
            id: `${subjectKey}-ia`,
            name: "Internal Assessment",
            type: "folder" as const,
            children: [
              {
                id: `${subjectKey}-ia-drafts`,
                name: "Drafts",
                type: "folder" as const,
              },
              {
                id: `${subjectKey}-ia-sources`,
                name: "Sources & References",
                type: "folder" as const,
              },
            ],
          },
        ]
      : []),
  ];

  return {
    subjectId: subject.id,
    subjectName: subject.name,
    level: subject.level,
    folders,
    iaConfig,
    syllabusTopics: topics,
  };
}

export function generateAllWorkspaces(
  subjects: SubjectSelection[]
): GeneratedWorkspace[] {
  return subjects.map((subject) => generateWorkspace(subject));
}
