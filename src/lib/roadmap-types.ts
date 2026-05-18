export const ROADMAP_CATEGORIES = [
  "exam",
  "mock_exam",
  "ia",
  "ee",
  "tok",
  "cas",
  "revision",
  "custom",
] as const;

export const ROADMAP_STATUSES = [
  "upcoming",
  "active",
  "done",
  "deferred",
] as const;

export const ROADMAP_PRIORITIES = [
  "low",
  "medium",
  "high",
  "urgent",
] as const;

export type RoadmapCategory = (typeof ROADMAP_CATEGORIES)[number];
export type RoadmapStatus = (typeof ROADMAP_STATUSES)[number];
export type RoadmapPriority = (typeof ROADMAP_PRIORITIES)[number];
export type RoadmapSourceType =
  | "profile"
  | "subject"
  | "ia"
  | "ee"
  | "tok"
  | "cas"
  | "custom";

export type RoadmapItem = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: RoadmapCategory;
  status: RoadmapStatus;
  priority: RoadmapPriority;
  start_date: string | null;
  due_date: string | null;
  subject_id: string | null;
  source_type: RoadmapSourceType;
  source_id: string | null;
  parent_id: string | null;
  generated_key: string | null;
  manual_override: boolean;
  hidden: boolean;
  notes: string | null;
  linked_task_id: string | null;
  linked_milestone_id: string | null;
  created_at: string;
  updated_at: string | null;
};

export type RoadmapInsight = {
  id: string;
  user_id: string;
  summary: string;
  next_actions: string[];
  risk_flags: string[];
  model: string | null;
  generated_at: string;
};

export type RoadmapSubject = {
  id: string;
  subject_name: string;
  level: string;
  subject_group?: number | null;
};

export type RoadmapProjectMilestone = {
  id?: string;
  title?: string;
  completed?: boolean;
  order?: number;
};

export type RoadmapIA = {
  id: string;
  title: string | null;
  status: string;
  due_date: string | null;
  subject_id: string | null;
  milestones?: RoadmapProjectMilestone[] | string[] | null;
};

export type RoadmapEE = {
  id: string;
  title?: string | null;
  subject?: string | null;
  status?: string | null;
  word_count?: number | null;
  milestones?: RoadmapProjectMilestone[] | string[] | null;
};

export type RoadmapTOK = {
  id: string;
  essay_title?: string | null;
  prescribed_title?: string | null;
  status?: string | null;
  exhibition_objects?: Array<{ title?: string; description?: string }> | null;
};

export type RoadmapCASExperience = {
  id: string;
  title: string;
  type: string;
  status: string;
};

export type RoadmapProfile = {
  exam_session?: string | null;
};

export type RoadmapGenerationContext = {
  profile: RoadmapProfile | null;
  subjects: RoadmapSubject[];
  internalAssessments: RoadmapIA[];
  ee: RoadmapEE | null;
  tok: RoadmapTOK | null;
  casExperiences: RoadmapCASExperience[];
};

export type RoadmapGeneratedItem = Omit<
  RoadmapItem,
  "id" | "user_id" | "created_at" | "updated_at"
> & {
  generated_key: string;
};
