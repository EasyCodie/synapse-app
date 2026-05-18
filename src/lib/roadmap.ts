import { createClient } from "@/lib/local/client";
import type {
  RoadmapCASExperience,
  RoadmapCategory,
  RoadmapEE,
  RoadmapGeneratedItem,
  RoadmapGenerationContext,
  RoadmapIA,
  RoadmapInsight,
  RoadmapItem,
  RoadmapPriority,
  RoadmapProjectMilestone,
  RoadmapStatus,
  RoadmapSubject,
  RoadmapTOK,
} from "@/lib/roadmap-types";

type LocalClient = Awaited<ReturnType<typeof createClient>>;

type ParsedExamSession = {
  label: string;
  session: "may" | "november";
  year: number;
  examDate: string;
};

type MilestoneSeed = {
  id: string;
  title: string;
  completed?: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const IA_FALLBACK_MILESTONES: MilestoneSeed[] = [
  { id: "research-question", title: "Confirm research question" },
  { id: "method", title: "Complete method and data plan" },
  { id: "first-draft", title: "Submit first draft" },
  { id: "revision", title: "Revise with teacher feedback" },
  { id: "final", title: "Final IA submission" },
];

const EE_FALLBACK_MILESTONES: MilestoneSeed[] = [
  { id: "proposal", title: "Research proposal" },
  { id: "outline", title: "Essay outline" },
  { id: "first-draft", title: "First draft" },
  { id: "feedback-revision", title: "Supervisor feedback revision" },
  { id: "final", title: "Final EE submission" },
];

const TOK_MILESTONES: MilestoneSeed[] = [
  { id: "exhibition-objects", title: "Select three exhibition objects" },
  { id: "exhibition-commentary", title: "Draft exhibition commentary" },
  { id: "essay-outline", title: "Outline TOK essay argument" },
  { id: "essay-draft", title: "Complete TOK essay draft" },
  { id: "portfolio-final", title: "Finalize TOK portfolio" },
];

const CAS_MILESTONES: MilestoneSeed[] = [
  { id: "plan", title: "Set CAS goals and experience mix" },
  { id: "reflection-cycle-1", title: "Complete first CAS reflection cycle" },
  { id: "midpoint-review", title: "CAS midpoint evidence review" },
  { id: "reflection-cycle-2", title: "Complete second CAS reflection cycle" },
  { id: "final-portfolio", title: "Finalize CAS portfolio evidence" },
];

export function getTodayKey(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseExamSession(
  examSession: string | null | undefined
): ParsedExamSession | null {
  if (!examSession) return null;
  const compact = examSession.trim();

  const wordMatch = compact.match(/^(May|November|Nov)\s+(\d{4})$/i);
  if (wordMatch) {
    const rawSession = wordMatch[1]!.toLowerCase();
    const session = rawSession.startsWith("may") ? "may" : "november";
    const year = Number(wordMatch[2]);
    return {
      label: `${session === "may" ? "May" : "November"} ${year}`,
      session,
      year,
      examDate: dateFromParts(year, session === "may" ? 4 : 10, 20),
    };
  }

  const shortMatch = compact.match(/^([MN])(\d{2}|\d{4})$/i);
  if (shortMatch) {
    const session = shortMatch[1]!.toUpperCase() === "M" ? "may" : "november";
    const rawYear = shortMatch[2]!;
    const year = rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear);
    return {
      label: `${session === "may" ? "May" : "November"} ${year}`,
      session,
      year,
      examDate: dateFromParts(year, session === "may" ? 4 : 10, 20),
    };
  }

  return null;
}

export async function loadRoadmapContext(
  userId: string,
  localClient?: LocalClient
): Promise<RoadmapGenerationContext> {
  const local = localClient ?? (await createClient());
  const [
    profileResult,
    subjectsResult,
    iaResult,
    eeResult,
    tokResult,
    casResult,
  ] = await Promise.all([
    local
      .from("profiles")
      .select("exam_session")
      .eq("id", userId)
      .maybeSingle(),
    local
      .from("user_subjects")
      .select("id, subject_name, level, subject_group")
      .eq("user_id", userId)
      .order("subject_group"),
    local
      .from("internal_assessments")
      .select("id, title, status, due_date, subject_id, milestones")
      .eq("user_id", userId),
    local
      .from("ee_tracker")
      .select("id, title, subject, status, word_count, milestones")
      .eq("user_id", userId)
      .maybeSingle(),
    local
      .from("tok_tracker")
      .select("id, essay_title, prescribed_title, status, exhibition_objects")
      .eq("user_id", userId)
      .maybeSingle(),
    local
      .from("cas_experiences")
      .select("id, title, type, status")
      .eq("user_id", userId),
  ]);

  return {
    profile: profileResult.data ?? null,
    subjects: (subjectsResult.data ?? []) as RoadmapSubject[],
    internalAssessments: (iaResult.data ?? []) as RoadmapIA[],
    ee: (eeResult.data ?? null) as RoadmapEE | null,
    tok: (tokResult.data ?? null) as RoadmapTOK | null,
    casExperiences: (casResult.data ?? []) as RoadmapCASExperience[],
  };
}

export function generateRoadmapItems(
  context: RoadmapGenerationContext,
  options: { today?: string } = {}
) {
  const today = options.today ?? getTodayKey();
  const parsedSession = parseExamSession(context.profile?.exam_session);
  const examDate = parsedSession?.examDate ?? addDays(today, 365);
  const sessionLabel = parsedSession?.label ?? "IB final";
  const mockDate = addDays(examDate, -56);
  const items: RoadmapGeneratedItem[] = [];

  items.push(
    createGeneratedItem({
      today,
      generated_key: `profile:${sessionLabel}:final-exams`,
      title: `${sessionLabel} final exams`,
      description:
        "Approximate final exam planning anchor based on the selected exam session. Replace with school or IB dates when known.",
      category: "exam",
      priority: "urgent",
      start_date: addDays(examDate, -21),
      due_date: examDate,
      source_type: "profile",
      source_id: parsedSession ? `${parsedSession.session}-${parsedSession.year}` : null,
    })
  );

  items.push(
    createGeneratedItem({
      today,
      generated_key: `profile:${sessionLabel}:mock-exams`,
      title: "Mock exam window",
      description:
        "Suggested mock exam planning window. Adjust this to match the dates set by your school.",
      category: "mock_exam",
      priority: "high",
      start_date: addDays(mockDate, -14),
      due_date: mockDate,
      source_type: "profile",
      source_id: parsedSession ? `${parsedSession.session}-${parsedSession.year}` : null,
    })
  );

  for (const subject of context.subjects) {
    items.push(...generateSubjectRevisionItems(subject, examDate, mockDate, today));
  }

  for (const ia of context.internalAssessments) {
    items.push(...generateIaItems(ia, context.subjects, examDate, today));
  }

  if (context.ee) {
    items.push(...generateEeItems(context.ee, examDate, today));
  }

  if (context.tok) {
    items.push(...generateTokItems(context.tok, examDate, today));
  }

  items.push(...generateCasItems(context.casExperiences, examDate, today));

  return dedupeGeneratedItems(items).sort(compareRoadmapItems);
}

export async function generateAndMergeRoadmap(
  userId: string,
  options: { today?: string; localClient?: LocalClient } = {}
) {
  const local = options.localClient ?? (await createClient());
  const context = await loadRoadmapContext(userId, local);
  const generatedItems = generateRoadmapItems(context, { today: options.today });
  const items = await mergeGeneratedRoadmapItems(userId, generatedItems, local);
  return { context, items };
}

export async function ensureRoadmapForUser(
  userId: string,
  options: { today?: string; localClient?: LocalClient } = {}
) {
  const local = options.localClient ?? (await createClient());
  const { data } = await local
    .from("roadmap_items")
    .select("id")
    .eq("user_id", userId)
    .limit(1);

  if ((data ?? []).length > 0) {
    return loadRoadmapData(userId, { localClient: local });
  }

  const { context, items } = await generateAndMergeRoadmap(userId, {
    today: options.today,
    localClient: local,
  });
  const insight = createFallbackRoadmapInsight(context, items, {
    today: options.today,
    model: "deterministic",
  });
  await saveRoadmapInsight(userId, insight, local);
  return loadRoadmapData(userId, { localClient: local });
}

export async function loadRoadmapData(
  userId: string,
  options: { includeHidden?: boolean; localClient?: LocalClient } = {}
) {
  const local = options.localClient ?? (await createClient());
  const [itemsResult, insightResult] = await Promise.all([
    local
      .from("roadmap_items")
      .select("*")
      .eq("user_id", userId)
      .order("due_date", { ascending: true }),
    local
      .from("roadmap_insights")
      .select("*")
      .eq("user_id", userId)
      .order("generated_at", { ascending: false })
      .limit(1),
  ]);

  const items = ((itemsResult.data ?? []) as RoadmapItem[])
    .filter((item) => options.includeHidden || !item.hidden)
    .sort(compareRoadmapItems);

  return {
    items,
    insight: ((insightResult.data ?? [])[0] ?? null) as RoadmapInsight | null,
  };
}

export function createFallbackRoadmapInsight(
  context: RoadmapGenerationContext,
  items: RoadmapItem[],
  options: { today?: string; model?: string | null } = {}
): Omit<RoadmapInsight, "id" | "user_id"> {
  const today = options.today ?? getTodayKey();
  const visible = items
    .filter((item) => !item.hidden && item.status !== "done")
    .sort(compareRoadmapItems);
  const active = visible.filter((item) => item.status === "active");
  const next = visible.slice(0, 5);
  const first = active[0] ?? next[0] ?? null;
  const subjectCount = context.subjects.length;
  const session = context.profile?.exam_session ?? "your exam session";

  const summary = first
    ? `${active.length} active checkpoint${active.length === 1 ? "" : "s"} and ${visible.length} open roadmap item${visible.length === 1 ? "" : "s"} are planned for ${session}. Focus now on ${first.title}.`
    : `Roadmap is clear for ${session}. Keep subjects, EE, TOK, CAS, and IAs updated as school dates change.`;

  const nextActions =
    next.length > 0
      ? next.slice(0, 5).map((item) => formatAction(item))
      : [
          subjectCount > 0
            ? "Refresh Roadmap after adding school dates or coursework updates."
            : "Complete onboarding so Roadmap can build your IB timeline.",
        ];

  const overdueHigh = visible.filter(
    (item) =>
      item.due_date &&
      item.due_date < today &&
      (item.priority === "high" || item.priority === "urgent")
  );
  const riskFlags = [
    ...overdueHigh
      .slice(0, 3)
      .map((item) => `${item.title} is past its suggested date.`),
    ...buildCategoryRiskFlags(visible),
  ].slice(0, 3);

  return {
    summary,
    next_actions: nextActions,
    risk_flags: riskFlags,
    model: options.model ?? "deterministic",
    generated_at: new Date().toISOString(),
  };
}

export async function saveRoadmapInsight(
  userId: string,
  insight: Omit<RoadmapInsight, "id" | "user_id">,
  localClient?: LocalClient
) {
  const local = localClient ?? (await createClient());
  const { data, error } = await local
    .from("roadmap_insights")
    .insert({
      user_id: userId,
      summary: insight.summary,
      next_actions: insight.next_actions,
      risk_flags: insight.risk_flags,
      model: insight.model,
      generated_at: insight.generated_at,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as RoadmapInsight;
}

export function compareRoadmapItems(a: Pick<RoadmapItem, "due_date" | "priority">, b: Pick<RoadmapItem, "due_date" | "priority">) {
  const leftDate = a.due_date ?? "9999-12-31";
  const rightDate = b.due_date ?? "9999-12-31";
  if (leftDate !== rightDate) return leftDate.localeCompare(rightDate);
  return priorityRank(b.priority) - priorityRank(a.priority);
}

async function mergeGeneratedRoadmapItems(
  userId: string,
  generatedItems: RoadmapGeneratedItem[],
  local: LocalClient
) {
  if (generatedItems.length === 0) return [];

  const { data: existingRows, error: existingError } = await local
    .from("roadmap_items")
    .select("*")
    .eq("user_id", userId);

  if (existingError) throw new Error(existingError.message);

  const existingByKey = new Map(
    ((existingRows ?? []) as RoadmapItem[])
      .filter((item) => item.generated_key)
      .map((item) => [item.generated_key!, item])
  );
  const now = new Date().toISOString();

  const rows = generatedItems.map((item) => {
    const existing = existingByKey.get(item.generated_key);
    const preserveManual = Boolean(existing?.manual_override);
    const preserveStatus =
      preserveManual || existing?.status === "done" || existing?.status === "deferred";

    return {
      ...(existing?.id ? { id: existing.id } : {}),
      user_id: userId,
      title: preserveManual ? existing?.title ?? item.title : item.title,
      description: preserveManual
        ? existing?.description ?? item.description
        : item.description,
      category: item.category,
      status: preserveStatus ? existing?.status ?? item.status : item.status,
      priority: preserveManual ? existing?.priority ?? item.priority : item.priority,
      start_date: preserveManual
        ? existing?.start_date ?? item.start_date
        : item.start_date,
      due_date: preserveManual ? existing?.due_date ?? item.due_date : item.due_date,
      subject_id: item.subject_id,
      source_type: item.source_type,
      source_id: item.source_id,
      parent_id: existing?.parent_id ?? item.parent_id,
      generated_key: item.generated_key,
      manual_override: existing?.manual_override ?? item.manual_override,
      hidden: existing?.hidden ?? item.hidden,
      notes: existing?.notes ?? item.notes,
      linked_task_id: existing?.linked_task_id ?? item.linked_task_id,
      linked_milestone_id:
        existing?.linked_milestone_id ?? item.linked_milestone_id,
      updated_at: now,
    };
  });

  const { error } = await local
    .from("roadmap_items")
    .upsert(rows, { onConflict: "user_id,generated_key" });

  if (error) throw new Error(error.message);

  const { data, error: loadError } = await local
    .from("roadmap_items")
    .select("*")
    .eq("user_id", userId)
    .order("due_date", { ascending: true });

  if (loadError) throw new Error(loadError.message);
  return ((data ?? []) as RoadmapItem[]).sort(compareRoadmapItems);
}

function generateSubjectRevisionItems(
  subject: RoadmapSubject,
  examDate: string,
  mockDate: string,
  today: string
) {
  const label = `${subject.subject_name} ${subject.level}`;
  return [
    createGeneratedItem({
      today,
      generated_key: `subject:${subject.id}:syllabus-audit`,
      title: `${label} syllabus audit`,
      description:
        "Check the syllabus checklist and identify weak topics before mock preparation starts.",
      category: "revision",
      priority: subject.level === "HL" ? "high" : "medium",
      start_date: addDays(mockDate, -42),
      due_date: addDays(mockDate, -28),
      subject_id: subject.id,
      source_type: "subject",
      source_id: subject.id,
    }),
    createGeneratedItem({
      today,
      generated_key: `subject:${subject.id}:past-paper-cycle`,
      title: `${label} past paper cycle`,
      description:
        "Complete a timed paper, mark it, and log the correction themes for revision.",
      category: "revision",
      priority: "high",
      start_date: addDays(mockDate, -21),
      due_date: addDays(mockDate, -7),
      subject_id: subject.id,
      source_type: "subject",
      source_id: subject.id,
    }),
    createGeneratedItem({
      today,
      generated_key: `subject:${subject.id}:final-revision-pack`,
      title: `${label} final revision pack`,
      description:
        "Consolidate formulae, essay plans, command terms, and recurring mistakes for final review.",
      category: "revision",
      priority: "high",
      start_date: addDays(examDate, -35),
      due_date: addDays(examDate, -14),
      subject_id: subject.id,
      source_type: "subject",
      source_id: subject.id,
    }),
  ];
}

function generateIaItems(
  ia: RoadmapIA,
  subjects: RoadmapSubject[],
  examDate: string,
  today: string
) {
  const subject = subjects.find((item) => item.id === ia.subject_id);
  const subjectLabel = subject
    ? `${subject.subject_name} ${subject.level}`
    : "Internal Assessment";
  const dueDate = normalizeDateKey(ia.due_date) ?? addDays(examDate, -126);
  const done = ia.status === "submitted";
  const items: RoadmapGeneratedItem[] = [
    createGeneratedItem({
      today,
      generated_key: `ia:${ia.id}:final`,
      title: `${subjectLabel} IA final submission`,
      description:
        "Complete the IA file, bibliography, appendices, and final academic honesty checks.",
      category: "ia",
      priority: "high",
      status: done ? "done" : undefined,
      start_date: addDays(dueDate, -21),
      due_date: dueDate,
      subject_id: ia.subject_id,
      source_type: "ia",
      source_id: ia.id,
    }),
  ];

  const milestones = normalizeMilestones(ia.milestones, IA_FALLBACK_MILESTONES);
  const dueDates = distributeDates(addDays(dueDate, -112), addDays(dueDate, -14), milestones.length);
  milestones.forEach((milestone, index) => {
    items.push(
      createGeneratedItem({
        today,
        generated_key: `ia:${ia.id}:checkpoint:${milestone.id}`,
        title: `${subjectLabel} IA: ${milestone.title}`,
        description:
          "Actionable IA checkpoint generated from your subject coursework structure.",
        category: "ia",
        priority: index >= milestones.length - 2 ? "high" : "medium",
        status: done || milestone.completed ? "done" : undefined,
        start_date: addDays(dueDates[index]!, -10),
        due_date: dueDates[index]!,
        subject_id: ia.subject_id,
        source_type: "ia",
        source_id: ia.id,
      })
    );
  });

  return items;
}

function generateEeItems(ee: RoadmapEE, examDate: string, today: string) {
  const dueDate = addDays(examDate, -84);
  const done = ee.status === "submitted";
  const title = ee.title?.trim() || "Extended Essay";
  const items: RoadmapGeneratedItem[] = [
    createGeneratedItem({
      today,
      generated_key: `ee:${ee.id}:final`,
      title: "Extended Essay final submission",
      description:
        "Finish the 4,000-word essay, citations, RPPF checks, and final supervisor sign-off.",
      category: "ee",
      priority: "high",
      status: done ? "done" : undefined,
      start_date: addDays(dueDate, -21),
      due_date: dueDate,
      source_type: "ee",
      source_id: ee.id,
    }),
  ];

  const milestones = normalizeMilestones(ee.milestones, EE_FALLBACK_MILESTONES);
  const dueDates = distributeDates(addDays(examDate, -308), addDays(examDate, -112), milestones.length);
  milestones.forEach((milestone, index) => {
    items.push(
      createGeneratedItem({
        today,
        generated_key: `ee:${ee.id}:checkpoint:${milestone.id}`,
        title: `${title}: ${milestone.title}`,
        description:
          "Break the Extended Essay into a checkpoint that can be completed and reviewed independently.",
        category: "ee",
        priority: index >= milestones.length - 2 ? "high" : "medium",
        status: done || milestone.completed ? "done" : undefined,
        start_date: addDays(dueDates[index]!, -14),
        due_date: dueDates[index]!,
        source_type: "ee",
        source_id: ee.id,
      })
    );
  });

  return items;
}

function generateTokItems(tok: RoadmapTOK, examDate: string, today: string) {
  const done = tok.status === "submitted";
  const essayTitle = tok.essay_title?.trim() || "TOK essay";
  const dueDate = addDays(examDate, -70);
  const dueDates = distributeDates(addDays(examDate, -252), dueDate, TOK_MILESTONES.length);
  const selectedObjects =
    tok.exhibition_objects?.filter((object) => object.title?.trim()).length ?? 0;

  return TOK_MILESTONES.map((milestone, index) =>
    createGeneratedItem({
      today,
      generated_key: `tok:${tok.id}:checkpoint:${milestone.id}`,
      title:
        milestone.id.startsWith("essay")
          ? `${essayTitle}: ${milestone.title}`
          : `TOK: ${milestone.title}`,
      description:
        "TOK checkpoint covering exhibition evidence, essay argument, or final portfolio readiness.",
      category: "tok",
      priority: index >= TOK_MILESTONES.length - 2 ? "high" : "medium",
      status:
        done ||
        (milestone.id === "exhibition-objects" && selectedObjects >= 3)
          ? "done"
          : undefined,
      start_date: addDays(dueDates[index]!, -14),
      due_date: dueDates[index]!,
      source_type: "tok",
      source_id: tok.id,
    })
  );
}

function generateCasItems(
  experiences: RoadmapCASExperience[],
  examDate: string,
  today: string
) {
  const completedCount = experiences.filter(
    (experience) => experience.status === "complete"
  ).length;
  const allDone = experiences.length > 0 && completedCount === experiences.length;
  const dueDates = distributeDates(addDays(examDate, -294), addDays(examDate, -42), CAS_MILESTONES.length);
  const items = CAS_MILESTONES.map((milestone, index) =>
    createGeneratedItem({
      today,
      generated_key: `cas:portfolio:${milestone.id}`,
      title: `CAS: ${milestone.title}`,
      description:
        "CAS checkpoint for sustained activity, balanced strands, reflections, and evidence.",
      category: "cas",
      priority: index === CAS_MILESTONES.length - 1 ? "high" : "medium",
      status: allDone && index < CAS_MILESTONES.length - 1 ? "done" : undefined,
      start_date: addDays(dueDates[index]!, -21),
      due_date: dueDates[index]!,
      source_type: "cas",
      source_id: "portfolio",
    })
  );

  for (const experience of experiences.filter(
    (item) => item.status !== "complete"
  )) {
    items.push(
      createGeneratedItem({
        today,
        generated_key: `cas:experience:${experience.id}:reflection`,
        title: `CAS reflection: ${experience.title}`,
        description:
          "Add a concise reflection and evidence for this CAS experience while the work is fresh.",
        category: "cas",
        priority: "medium",
        start_date: today,
        due_date: addDays(today, 21),
        source_type: "cas",
        source_id: experience.id,
      })
    );
  }

  return items;
}

function createGeneratedItem(input: {
  today: string;
  generated_key: string;
  title: string;
  description: string;
  category: RoadmapCategory;
  priority: RoadmapPriority;
  start_date: string;
  due_date: string;
  status?: RoadmapStatus;
  subject_id?: string | null;
  source_type: RoadmapGeneratedItem["source_type"];
  source_id?: string | null;
}): RoadmapGeneratedItem {
  return {
    title: input.title,
    description: input.description,
    category: input.category,
    status:
      input.status ??
      inferStatus(input.today, input.start_date, input.due_date),
    priority: input.priority,
    start_date: input.start_date,
    due_date: input.due_date,
    subject_id: input.subject_id ?? null,
    source_type: input.source_type,
    source_id: input.source_id ?? null,
    parent_id: null,
    generated_key: input.generated_key,
    manual_override: false,
    hidden: false,
    notes: null,
    linked_task_id: null,
    linked_milestone_id: null,
  };
}

function inferStatus(today: string, startDate: string, dueDate: string): RoadmapStatus {
  if (dueDate < today) return "active";
  if (startDate <= today) return "active";
  return "upcoming";
}

function normalizeMilestones(
  raw: RoadmapProjectMilestone[] | string[] | null | undefined,
  fallback: MilestoneSeed[]
): MilestoneSeed[] {
  if (!Array.isArray(raw) || raw.length === 0) return fallback;

  if (typeof raw[0] === "string") {
    const completedIds = new Set(raw as string[]);
    return fallback.map((milestone) => ({
      ...milestone,
      completed: completedIds.has(milestone.id),
    }));
  }

  const milestones: MilestoneSeed[] = [];
  (raw as RoadmapProjectMilestone[]).forEach((milestone, index) => {
    const title = milestone.title?.trim();
    if (!title) return;
    milestones.push({
      id: milestone.id?.trim() || slugify(title) || `milestone-${index + 1}`,
      title,
      completed: Boolean(milestone.completed),
    });
  });

  return milestones.length > 0 ? milestones : fallback;
}

function distributeDates(startDate: string, endDate: string, count: number) {
  if (count <= 1) return [endDate];
  const start = parseDateKey(startDate).getTime();
  const end = parseDateKey(endDate).getTime();
  const step = (end - start) / (count - 1);
  return Array.from({ length: count }, (_, index) =>
    dateKey(new Date(Math.round(start + step * index)))
  );
}

function dedupeGeneratedItems(items: RoadmapGeneratedItem[]) {
  const map = new Map<string, RoadmapGeneratedItem>();
  for (const item of items) map.set(item.generated_key, item);
  return Array.from(map.values());
}

function buildCategoryRiskFlags(items: RoadmapItem[]) {
  const categories: RoadmapCategory[] = ["ia", "ee", "tok", "cas"];
  return categories
    .filter((category) => !items.some((item) => item.category === category))
    .map((category) => `No open ${category.toUpperCase()} checkpoints are currently visible.`);
}

function formatAction(item: RoadmapItem) {
  const due = item.due_date ? ` by ${formatDisplayDate(item.due_date)}` : "";
  return `${item.title}${due}`;
}

function formatDisplayDate(date: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(parseDateKey(date));
}

function priorityRank(priority: RoadmapPriority) {
  const ranks: Record<RoadmapPriority, number> = {
    low: 0,
    medium: 1,
    high: 2,
    urgent: 3,
  };
  return ranks[priority] ?? 0;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeDateKey(value: string | null | undefined) {
  if (!value) return null;
  const match = value.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
}

function addDays(date: string, days: number) {
  return dateKey(new Date(parseDateKey(date).getTime() + days * DAY_MS));
}

function dateFromParts(year: number, monthIndex: number, day: number) {
  return dateKey(new Date(Date.UTC(year, monthIndex, day)));
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseDateKey(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
}
