import OpenAI from "openai";
import { createHash } from "crypto";
import {
  createFallbackRoadmapInsight,
  getTodayKey,
} from "@/lib/roadmap";
import type {
  RoadmapGenerationContext,
  RoadmapInsight,
  RoadmapItem,
} from "@/lib/roadmap-types";

const ROADMAP_MODEL = process.env.OPENAI_CHAT_MODEL ?? "gpt-5.4-nano-2026-03-17";
const ROADMAP_INSIGHT_PROMPT_VERSION = "roadmap-insight-v1";
const ROADMAP_INSIGHT_CACHE_TTL_MS = 15 * 60 * 1000;

type InsightPayload = Pick<
  RoadmapInsight,
  "summary" | "next_actions" | "risk_flags"
>;

type CachedInsight = {
  value: Omit<RoadmapInsight, "id" | "user_id">;
  createdAt: number;
};

const insightCache = new Map<string, CachedInsight>();
let cacheHits = 0;
let cacheMisses = 0;

export async function generateRoadmapInsight(
  context: RoadmapGenerationContext,
  items: RoadmapItem[],
  options: { today?: string; useAi?: boolean } = {}
): Promise<Omit<RoadmapInsight, "id" | "user_id">> {
  const today = options.today ?? getTodayKey();
  const cacheKey = buildRoadmapInsightCacheKey(context, items, { today });
  const cached = getCachedInsight(cacheKey);
  if (cached) return cached;

  cacheMisses++;
  const fallback = createFallbackRoadmapInsight(context, items, {
    today,
    model: "deterministic",
  });

  if (options.useAi === false || !process.env.OPENAI_API_KEY) {
    setCachedInsight(cacheKey, fallback);
    return fallback;
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: ROADMAP_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You generate concise academic planning guidance for an IB Diploma student. Return strict JSON only with summary, next_actions, and risk_flags. Dates are planning suggestions unless the student has entered school dates.",
        },
        {
          role: "user",
          content: JSON.stringify(buildInsightContext(context, items, today)),
        },
      ],
      temperature: 0.2,
      max_completion_tokens: 600,
    });

    const content = completion.choices[0]?.message?.content ?? "";
    const parsed = parseInsightPayload(content);
    if (!parsed) {
      setCachedInsight(cacheKey, fallback);
      return fallback;
    }

    const insight = {
      summary: parsed.summary,
      next_actions: parsed.next_actions,
      risk_flags: parsed.risk_flags,
      model: ROADMAP_MODEL,
      generated_at: new Date().toISOString(),
    };
    setCachedInsight(cacheKey, insight);
    return insight;
  } catch (error) {
    console.error("Roadmap insight generation failed:", error);
    setCachedInsight(cacheKey, fallback);
    return fallback;
  }
}

export function clearRoadmapInsightCache() {
  insightCache.clear();
}

export function buildRoadmapInsightCacheKey(
  context: RoadmapGenerationContext,
  items: RoadmapItem[],
  options: { today?: string } = {}
) {
  const payload = {
    model: ROADMAP_MODEL,
    prompt_version: ROADMAP_INSIGHT_PROMPT_VERSION,
    today: options.today ?? getTodayKey(),
    context: {
      profile: context.profile,
      subjects: context.subjects,
      internalAssessments: context.internalAssessments,
      ee: context.ee,
      tok: context.tok,
      casExperiences: context.casExperiences,
    },
    items: items
      .map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        category: item.category,
        status: item.status,
        priority: item.priority,
        start_date: item.start_date,
        due_date: item.due_date,
        subject_id: item.subject_id,
        parent_id: item.parent_id,
        generated_key: item.generated_key,
        manual_override: item.manual_override,
        hidden: item.hidden,
        notes: item.notes,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  };

  return createHash("sha256")
    .update(stableStringify(payload))
    .digest("hex");
}

export function getRoadmapInsightCacheStatsForTest() {
  return {
    size: insightCache.size,
    hits: cacheHits,
    misses: cacheMisses,
  };
}

function buildInsightContext(
  context: RoadmapGenerationContext,
  items: RoadmapItem[],
  today: string
) {
  const openItems = items
    .filter((item) => !item.hidden && item.status !== "done")
    .slice(0, 30)
    .map((item) => ({
      title: item.title,
      category: item.category,
      status: item.status,
      priority: item.priority,
      start_date: item.start_date,
      due_date: item.due_date,
    }));

  return {
    today,
    exam_session: context.profile?.exam_session ?? null,
    subjects: context.subjects.map((subject) => ({
      name: subject.subject_name,
      level: subject.level,
    })),
    coursework: {
      ia_count: context.internalAssessments.length,
      ee_status: context.ee?.status ?? null,
      tok_status: context.tok?.status ?? null,
      cas_experience_count: context.casExperiences.length,
    },
    open_roadmap_items: openItems,
    output_contract: {
      summary: "One sentence, under 45 words.",
      next_actions: "3 to 5 concrete actions, each under 18 words.",
      risk_flags: "0 to 3 concise risks. Empty array if none.",
    },
  };
}

function parseInsightPayload(content: string): InsightPayload | null {
  const trimmed = content.trim().replace(/^```json\s*|\s*```$/g, "");
  try {
    const raw = JSON.parse(trimmed) as Partial<InsightPayload>;
    const summary = typeof raw.summary === "string" ? raw.summary.trim() : "";
    const nextActions = normalizeStringArray(raw.next_actions, 5);
    const riskFlags = normalizeStringArray(raw.risk_flags, 3);

    if (!summary || nextActions.length === 0) return null;
    return {
      summary: summary.slice(0, 320),
      next_actions: nextActions,
      risk_flags: riskFlags,
    };
  } catch {
    return null;
  }
}

function normalizeStringArray(value: unknown, maxLength: number) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, maxLength);
}

function getCachedInsight(key: string) {
  const cached = insightCache.get(key);
  if (!cached) return null;

  if (Date.now() - cached.createdAt > ROADMAP_INSIGHT_CACHE_TTL_MS) {
    insightCache.delete(key);
    return null;
  }

  cacheHits++;
  return cached.value;
}

function setCachedInsight(
  key: string,
  value: Omit<RoadmapInsight, "id" | "user_id">
) {
  insightCache.set(key, {
    value,
    createdAt: Date.now(),
  });
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}
