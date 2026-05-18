import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "fs";
import {
  createClient,
  getLocalDataPaths,
  getLocalDb,
} from "@/lib/local/client";
import {
  generateAndMergeRoadmap,
  generateRoadmapItems,
  parseExamSession,
} from "@/lib/roadmap";
import {
  createRoadmapItem as createRoadmapItemAction,
  findRoadmapItems as findRoadmapItemsAction,
  getRoadmapOverview as getRoadmapOverviewAction,
  regenerateRoadmap as regenerateRoadmapAction,
  splitRoadmapItem as splitRoadmapItemAction,
  updateRoadmapItem as updateRoadmapItemAction,
} from "@/lib/roadmap-actions";
import {
  clearRoadmapInsightCache,
  generateRoadmapInsight,
  getRoadmapInsightCacheStatsForTest,
} from "@/lib/roadmap-ai";
import type { RoadmapGenerationContext } from "@/lib/roadmap-types";
import { POST as linkRoadmapItem } from "@/app/api/roadmap/items/link/route";

async function resetLocalData() {
  const { dataDir } = getLocalDataPaths();
  await fs.rm(dataDir, { recursive: true, force: true });
}

function sampleContext(): RoadmapGenerationContext {
  return {
    profile: { exam_session: "May 2027" },
    subjects: [
      {
        id: "subject-chem",
        subject_name: "Chemistry",
        level: "HL",
        subject_group: 4,
      },
    ],
    internalAssessments: [
      {
        id: "ia-chem",
        title: "Chemistry IA",
        status: "not_started",
        due_date: null,
        subject_id: "subject-chem",
        milestones: [
          { id: "rq", title: "Research question", completed: false },
          { id: "draft", title: "First draft", completed: false },
        ],
      },
    ],
    ee: {
      id: "ee-1",
      title: "Extended Essay",
      status: "planning",
      word_count: 0,
      milestones: [],
    },
    tok: {
      id: "tok-1",
      essay_title: "",
      prescribed_title: "",
      status: "planning",
      exhibition_objects: [],
    },
    casExperiences: [],
  };
}

describe("roadmap planning", () => {
  beforeEach(async () => {
    await resetLocalData();
  });

  afterEach(async () => {
    await resetLocalData();
  });

  it("parses long and compact IB exam sessions", () => {
    expect(parseExamSession("May 2027")).toMatchObject({
      session: "may",
      year: 2027,
      examDate: "2027-05-20",
    });
    expect(parseExamSession("N26")).toMatchObject({
      session: "november",
      year: 2026,
      examDate: "2026-11-20",
    });
  });

  it("generates exams, mocks, core, IA, CAS, and revision checkpoints", () => {
    const items = generateRoadmapItems(sampleContext(), { today: "2026-05-17" });
    const categories = new Set(items.map((item) => item.category));

    expect(categories).toEqual(
      new Set(["exam", "mock_exam", "revision", "ia", "ee", "tok", "cas"])
    );
    expect(items.some((item) => item.title === "May 2027 final exams")).toBe(true);
    expect(items.some((item) => item.title.includes("Chemistry HL IA"))).toBe(true);
    expect(items.some((item) => item.title.includes("Extended Essay"))).toBe(true);
    expect(items.some((item) => item.title.includes("TOK"))).toBe(true);
    expect(items.some((item) => item.title.includes("CAS"))).toBe(true);
  });

  it("merges idempotently while preserving manual roadmap edits", async () => {
    const local = await createClient();
    await seedWorkspace(local);

    const first = await generateAndMergeRoadmap("personal-user", {
      today: "2026-05-17",
      localClient: local,
    });
    const target = first.items.find((item) => item.generated_key?.includes(":final"));
    expect(target).toBeTruthy();

    await local
      .from("roadmap_items")
      .update({
        due_date: "2026-12-31",
        status: "deferred",
        notes: "School deadline changed",
        manual_override: true,
      })
      .eq("id", target!.id)
      .eq("user_id", "personal-user");

    const second = await generateAndMergeRoadmap("personal-user", {
      today: "2026-05-17",
      localClient: local,
    });
    const preserved = second.items.find((item) => item.id === target!.id);

    expect(second.items).toHaveLength(first.items.length);
    expect(preserved?.due_date).toBe("2026-12-31");
    expect(preserved?.status).toBe("deferred");
    expect(preserved?.notes).toBe("School deadline changed");
  });

  it("links a roadmap item to one reusable task", async () => {
    const local = await createClient();
    await seedWorkspace(local);
    const { items } = await generateAndMergeRoadmap("personal-user", {
      today: "2026-05-17",
      localClient: local,
    });
    const target = items[0]!;

    const response = await linkRoadmapItem(
      new Request("http://localhost/api/roadmap/items/link", {
        method: "POST",
        body: JSON.stringify({ id: target.id, kind: "task" }),
      })
    );
    const repeat = await linkRoadmapItem(
      new Request("http://localhost/api/roadmap/items/link", {
        method: "POST",
        body: JSON.stringify({ id: target.id, kind: "task" }),
      })
    );
    const db = await getLocalDb();

    expect(response.status).toBe(200);
    expect(repeat.status).toBe(200);
    expect(db.tasks).toHaveLength(1);
    expect(db.roadmap_items.find((item) => item.id === target.id)?.linked_task_id)
      .toBe(db.tasks[0]?.id);
  });

  it("overviews and finds only user-scoped visible roadmap items by default", async () => {
    const local = await createClient();
    await local.from("roadmap_items").insert([
      {
        id: "visible-roadmap",
        user_id: "personal-user",
        title: "Chemistry revision",
        category: "revision",
        status: "active",
        priority: "high",
        due_date: "2026-06-01",
      },
      {
        id: "hidden-roadmap",
        user_id: "personal-user",
        title: "Hidden IA checkpoint",
        category: "ia",
        status: "active",
        priority: "medium",
        hidden: true,
        due_date: "2026-06-02",
      },
      {
        id: "other-roadmap",
        user_id: "other-user",
        title: "Other user item",
        category: "revision",
        status: "active",
        priority: "urgent",
        due_date: "2026-06-03",
      },
    ]);

    const overview = await getRoadmapOverviewAction(
      "personal-user",
      { limit: 10 },
      local
    );
    const found = await findRoadmapItemsAction(
      "personal-user",
      { query: "checkpoint" },
      local
    );
    const hiddenFound = await findRoadmapItemsAction(
      "personal-user",
      { query: "checkpoint", include_hidden: true },
      local
    );

    expect(overview.counts.total).toBe(2);
    expect(overview.timeline.map((item) => item.id)).toEqual(["visible-roadmap"]);
    expect(found).toHaveLength(0);
    expect(hiddenFound.map((item) => item.id)).toEqual(["hidden-roadmap"]);
  });

  it("validates roadmap updates and marks manual overrides", async () => {
    const local = await createClient();
    const item = await createRoadmapItemAction(
      "personal-user",
      {
        title: "TOK essay draft",
        category: "tok",
        due_date: "2026-09-01",
      },
      local
    );

    await expect(
      updateRoadmapItemAction(
        "personal-user",
        { id: item.id, due_date: "09/01/2026" },
        local
      )
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      updateRoadmapItemAction(
        "personal-user",
        { id: item.id, status: "blocked" as never },
        local
      )
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      updateRoadmapItemAction(
        "personal-user",
        { id: item.id, priority: "critical" as never },
        local
      )
    ).rejects.toMatchObject({ status: 400 });

    const updated = await updateRoadmapItemAction(
      "personal-user",
      {
        id: item.id,
        due_date: "2026-09-10",
        status: "deferred",
        priority: "high",
      },
      local
    );

    expect(updated.due_date).toBe("2026-09-10");
    expect(updated.status).toBe("deferred");
    expect(updated.priority).toBe("high");
    expect(updated.manual_override).toBe(true);
  });

  it("splits a roadmap item into child checkpoints", async () => {
    const local = await createClient();
    const parent = await createRoadmapItemAction(
      "personal-user",
      {
        title: "Extended Essay final submission",
        category: "ee",
        priority: "high",
      },
      local
    );

    const children = await splitRoadmapItemAction(
      "personal-user",
      {
        id: parent.id,
        checkpoints: [
          { title: "EE outline", due_date: "2026-07-01" },
          { title: "EE first draft", due_date: "2026-08-01", priority: "high" },
        ],
      },
      local
    );

    expect(children).toHaveLength(2);
    expect(children.every((item) => item.parent_id === parent.id)).toBe(true);
    expect(children.map((item) => item.category)).toEqual(["ee", "ee"]);
  });

  it("regenerates while preserving done, deferred, and hidden generated items", async () => {
    const local = await createClient();
    await seedWorkspace(local);
    const { items } = await generateAndMergeRoadmap("personal-user", {
      today: "2026-05-17",
      localClient: local,
    });
    const target = items.find((item) => item.generated_key?.includes(":final"));
    expect(target).toBeTruthy();

    await local
      .from("roadmap_items")
      .update({
        status: "done",
        hidden: true,
        manual_override: false,
      })
      .eq("id", target!.id)
      .eq("user_id", "personal-user");

    await regenerateRoadmapAction("personal-user", { use_ai: false }, local);
    const db = await getLocalDb();
    const preserved = db.roadmap_items.find((item) => item.id === target!.id);

    expect(preserved?.status).toBe("done");
    expect(preserved?.hidden).toBe(true);
  });

  it("caches roadmap insight only when the context hash matches", async () => {
    clearRoadmapInsightCache();
    const context = sampleContext();
    const baseItems = generateRoadmapItems(context, { today: "2026-05-17" }).map(
      (item, index) => ({
        id: `item-${index}`,
        user_id: "personal-user",
        created_at: "2026-05-17T00:00:00.000Z",
        updated_at: null,
        ...item,
      })
    );
    const before = getRoadmapInsightCacheStatsForTest();

    await generateRoadmapInsight(context, baseItems, {
      today: "2026-05-17",
      useAi: false,
    });
    await generateRoadmapInsight(context, baseItems, {
      today: "2026-05-17",
      useAi: false,
    });
    const changedItems = baseItems.map((item, index) =>
      index === 0 ? { ...item, status: "done" as const } : item
    );
    await generateRoadmapInsight(context, changedItems, {
      today: "2026-05-17",
      useAi: false,
    });
    const after = getRoadmapInsightCacheStatsForTest();

    expect(after.size).toBe(2);
    expect(after.hits - before.hits).toBe(1);
    expect(after.misses - before.misses).toBe(2);
  });
});

async function seedWorkspace(local: Awaited<ReturnType<typeof createClient>>) {
  await local.from("profiles").upsert({
    id: "personal-user",
    exam_session: "May 2027",
    onboarding_complete: true,
    full_name: "Ivan",
  });
  await local.from("user_subjects").insert({
    id: "subject-chem",
    user_id: "personal-user",
    subject_name: "Chemistry",
    subject_group: 4,
    level: "HL",
    language: "English",
  });
  await local.from("internal_assessments").insert({
    id: "ia-chem",
    user_id: "personal-user",
    subject_id: "subject-chem",
    title: "Chemistry IA",
    status: "not_started",
    milestones: [{ id: "draft", title: "First draft", completed: false }],
  });
  await local.from("ee_tracker").insert({
    id: "ee-1",
    user_id: "personal-user",
    title: "Extended Essay",
    subject: "Chemistry",
    status: "planning",
    word_count: 0,
    milestones: [],
  });
  await local.from("tok_tracker").insert({
    id: "tok-1",
    user_id: "personal-user",
    essay_title: "",
    prescribed_title: "",
    status: "planning",
    exhibition_objects: [],
  });
}
