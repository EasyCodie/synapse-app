import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import {
  minutesToTime,
  timeToMinutes,
  type CalendarSubject,
} from "@/lib/school-schedule";
import { displaySubjectName } from "@/lib/subject-display";
import {
  matchScheduleSubjectId,
  normalizeScheduleSubjectName,
  normalizeScheduleTime,
  type ScheduleImportEntry,
  type ScheduleImportIssue,
  type ScheduleImportParseResult,
  type ScheduleImportWorkbook,
} from "@/lib/schedule-import";

export const SCHEDULE_IMPORT_AI_MODEL =
  process.env.OPENAI_CHAT_MODEL ?? "gpt-5.4-nano-2026-03-17";

const MAX_AI_SHEETS = 8;
const MAX_AI_ROWS_PER_SHEET = 180;
const MAX_AI_COLUMNS = 28;
const MAX_AI_CELL_CHARS = 140;
const MAX_AI_WORKBOOK_CHARS = 36000;

const AiScheduleEntrySchema = z.object({
  weekday: z.number(),
  subject: z.string(),
  subject_id: z.string().nullable(),
  start_time: z.string(),
  end_time: z.string(),
  duration_minutes: z.number().nullable(),
  room: z.string().nullable(),
  teacher: z.string().nullable(),
  source_row: z.number().nullable(),
  confidence: z.number(),
});

const AiScheduleIssueSchema = z.object({
  row: z.number(),
  message: z.string(),
});

const AiScheduleImportSchema = z.object({
  entries: z.array(AiScheduleEntrySchema),
  issues: z.array(AiScheduleIssueSchema),
});

type AiScheduleImportPayload = z.infer<typeof AiScheduleImportSchema>;

type AnalyzeScheduleImportOptions = {
  workbook: ScheduleImportWorkbook;
  subjects: CalendarSubject[];
  deterministicResult: ScheduleImportParseResult;
  model?: string;
};

export type ScheduleImportAiResult = ScheduleImportParseResult & {
  model: string;
};

export async function analyzeScheduleImportWithAi({
  workbook,
  subjects,
  deterministicResult,
  model = SCHEDULE_IMPORT_AI_MODEL,
}: AnalyzeScheduleImportOptions): Promise<ScheduleImportAiResult> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const compactWorkbook = compactWorkbookForAi(workbook);

  const completion = await openai.chat.completions.parse({
    model,
    messages: [
      {
        role: "system",
        content: [
          "You clean school timetable spreadsheet imports for an IB student.",
          "Analyze the raw workbook cells and return only recurring class schedule entries.",
          "Weekday values are Monday=1, Tuesday=2, Wednesday=3, Thursday=4, Friday=5, Saturday=6, Sunday=0.",
          "All times must be 24-hour HH:mm. Convert Excel time fractions, for example 0.375 means 09:00.",
          "Infer exact end times from explicit ranges, adjacent period boundaries, or stated durations.",
          "If a subject cell is merged across two adjacent period rows, or a subject repeats in consecutive periods on the same day, return one entry for each lesson period instead of collapsing them into a single long entry.",
          "Biology can appear as two consecutive lessons on Monday and Wednesday; preserve both lessons as separate adjacent Biology entries when the timetable shows them.",
          "Use the known subject list when possible, but return subject names exactly as base names without SL or HL level markers.",
          "Treat English and Language A: Literature as the same subject for this student, and return English.",
          "Never append, infer, or preserve SL/HL in the subject field. If the raw cell says 'Biology HL', return 'Biology'.",
          "Do not rename, translate, or embellish subject names. The only abbreviation to expand is EE, which means Extended Essay.",
          "Extended Essay is a subject, not a note, break, or core-program label to discard. If EE appears in the timetable, always return it as Extended Essay and place it on Thursday immediately after the last Math or Mathematics class when the file implies that placement.",
          "Do not import breaks, lunch, free periods, assemblies, notes, headers, totals, or blank cells as classes.",
          "If a file cannot produce a valid class schedule, return an empty entries array and concise issues.",
        ].join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({
          file_name: workbook.fileName,
          known_subjects: subjects.map((subject) => ({
            id: subject.id,
            label: displaySubjectName(subject.subject_name),
            subject_name: displaySubjectName(subject.subject_name),
            level: subject.level ?? null,
          })),
          deterministic_parser_hint: deterministicResult.entries
            .slice(0, 120)
            .map((entry) => ({
              weekday: entry.weekday,
              subject: entry.subject,
              subject_id: entry.subject_id,
              start_time: entry.start_time,
              end_time: entry.end_time,
              room: entry.room,
              teacher: entry.teacher,
            })),
          workbook_truncated: compactWorkbook.truncated,
          sheets: compactWorkbook.sheets,
          output_contract: {
            entries:
              "Clean recurring class rows only. Use subject_id from known_subjects when a class matches.",
            subject:
              "Base subject name only. Do not include SL/HL. Keep the source subject name unchanged except EE -> Extended Essay, Language A: Literature -> English, and removing standalone SL/HL markers.",
            start_time:
              "HH:mm. If the sheet stores decimals, convert from fraction of a day.",
            end_time:
              "HH:mm. If only a duration is visible, calculate the end time.",
            duration_minutes:
              "Integer minutes when visible or inferred, otherwise null.",
          },
        }),
      },
    ],
    response_format: zodResponseFormat(
      AiScheduleImportSchema,
      "schedule_import",
    ),
    temperature: 0.1,
    max_completion_tokens: 5000,
  });

  const message = completion.choices[0]?.message;
  if (message?.refusal) {
    return {
      model,
      entries: [],
      issues: [{ row: 0, message: "AI schedule cleanup was refused." }],
    };
  }

  const parsed = message?.parsed;
  if (!parsed) {
    return {
      model,
      entries: [],
      issues: [{ row: 0, message: "AI schedule cleanup returned no data." }],
    };
  }

  const cleaned = sanitizeAiScheduleImport(parsed, subjects);
  if (compactWorkbook.truncated) {
    cleaned.issues.push({
      row: 0,
      message:
        "The workbook was large, so only the first schedule-like cells were analyzed by AI.",
    });
  }

  return { model, ...cleaned };
}

export function sanitizeAiScheduleImport(
  payload: AiScheduleImportPayload,
  subjects: CalendarSubject[],
): ScheduleImportParseResult {
  const subjectsById = new Map(
    subjects.map((subject) => [subject.id, subject]),
  );
  const entries: ScheduleImportEntry[] = [];
  const issues: ScheduleImportIssue[] = payload.issues
    .map((issue) => ({
      row: Number.isFinite(issue.row) ? Math.max(0, Math.round(issue.row)) : 0,
      message: cleanText(issue.message, 160) ?? "AI noted an import issue.",
    }))
    .slice(0, 50);
  const seen = new Set<string>();

  for (const rawEntry of payload.entries.slice(0, 160)) {
    const row = Number.isFinite(rawEntry.source_row)
      ? Math.max(0, Math.round(rawEntry.source_row ?? 0))
      : 0;
    const knownSubject =
      rawEntry.subject_id && subjectsById.has(rawEntry.subject_id)
        ? subjectsById.get(rawEntry.subject_id)
        : null;
    const subjectText = cleanText(rawEntry.subject, 80) ?? "";
    const aiSubject = normalizeAiSubjectLabel(subjectText);
    const matchedSubjectId =
      knownSubject?.id ?? matchScheduleSubjectId(aiSubject, subjects);
    const matchedSubject = matchedSubjectId
      ? subjectsById.get(matchedSubjectId)
      : null;
    const subject = matchedSubject
      ? matchedSubject.subject_name
      : normalizeScheduleSubjectName(aiSubject, subjects);

    if (!subject || isNonClassLabel(subject)) {
      issues.push({
        row,
        message: "Skipped a non-class or empty schedule item.",
      });
      continue;
    }

    const startTime = normalizeScheduleTime(rawEntry.start_time);
    let endTime = normalizeScheduleTime(rawEntry.end_time);

    if (!endTime && startTime && rawEntry.duration_minutes) {
      const duration = Math.round(rawEntry.duration_minutes);
      const endMinutes = timeToMinutes(startTime) + duration;
      if (duration > 0 && endMinutes < 24 * 60) {
        endTime = minutesToTime(endMinutes);
      }
    }

    if (
      !Number.isInteger(rawEntry.weekday) ||
      rawEntry.weekday < 0 ||
      rawEntry.weekday > 6
    ) {
      issues.push({ row, message: "Skipped class with invalid weekday." });
      continue;
    }
    if (!startTime || !endTime) {
      issues.push({ row, message: "Skipped class with invalid time." });
      continue;
    }
    if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
      issues.push({
        row,
        message: "Skipped class because end time is not after start time.",
      });
      continue;
    }

    const entry: ScheduleImportEntry = {
      weekday: rawEntry.weekday,
      subject,
      subject_id: matchedSubjectId ?? null,
      start_time: startTime,
      end_time: endTime,
      room: cleanText(rawEntry.room, 40),
      teacher: cleanText(rawEntry.teacher, 80),
    };
    const key = scheduleImportEntryKey(entry);
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push(entry);
  }

  return {
    entries: dedupeScheduleEntries(
      placeExtendedEssayAfterThursdayMath(
        expandCollapsedConsecutiveLessons(entries),
      ),
    ),
    issues,
  };
}

function compactWorkbookForAi(workbook: ScheduleImportWorkbook) {
  const sheets: Array<{
    name: string;
    rows: Array<{ row: number; cells: string[] }>;
  }> = [];
  let usedChars = 0;
  let truncated = workbook.sheets.length > MAX_AI_SHEETS;

  for (const sheet of workbook.sheets.slice(0, MAX_AI_SHEETS)) {
    const rows: Array<{ row: number; cells: string[] }> = [];

    for (const [rowIndex, row] of sheet.rows.entries()) {
      if (rows.length >= MAX_AI_ROWS_PER_SHEET) {
        truncated = true;
        break;
      }

      const cells = row
        .slice(0, MAX_AI_COLUMNS)
        .map((cell) => cleanText(cell, MAX_AI_CELL_CHARS) ?? "");
      if (!cells.some(Boolean)) continue;

      const rowChars = sheet.name.length + cells.join("\t").length + 12;
      if (usedChars + rowChars > MAX_AI_WORKBOOK_CHARS) {
        truncated = true;
        break;
      }

      usedChars += rowChars;
      rows.push({ row: rowIndex + 1, cells });
    }

    if (rows.length > 0) sheets.push({ name: sheet.name, rows });
  }

  return { sheets, truncated };
}

function cleanText(value: unknown, maxLength: number) {
  const text = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return text ? text.slice(0, maxLength) : null;
}

function isNonClassLabel(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return new Set([
    "break",
    "lunch",
    "recess",
    "free",
    "free period",
    "study hall",
    "study period",
    "passing period",
    "assembly",
  ]).has(normalized);
}

function normalizeAiSubjectLabel(value: string) {
  const text = cleanText(value, 80) ?? "";
  if (
    /^e\.?\s*e\.?$/i.test(text) ||
    /^ee$/i.test(text) ||
    /\bextended\s+essay\b/i.test(text)
  ) {
    return "Extended Essay";
  }

  if (/^language\s*a(?:\s*:|\b)/i.test(text)) {
    return "English";
  }

  return text
    .replace(/\b(?:HL|SL)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function expandCollapsedConsecutiveLessons(entries: ScheduleImportEntry[]) {
  const lessonDuration = inferCommonLessonDuration(entries);
  if (!lessonDuration) return entries;

  return entries.flatMap((entry) => {
    const duration =
      timeToMinutes(entry.end_time) - timeToMinutes(entry.start_time);
    const lessonCount = Math.round(duration / lessonDuration);

    if (
      lessonCount < 2 ||
      lessonCount > 4 ||
      Math.abs(duration - lessonCount * lessonDuration) > 10 ||
      entry.subject === "Extended Essay"
    ) {
      return [entry];
    }

    const start = timeToMinutes(entry.start_time);
    return Array.from({ length: lessonCount }, (_, index) => ({
      ...entry,
      start_time: minutesToTime(start + index * lessonDuration),
      end_time: minutesToTime(
        index === lessonCount - 1
          ? timeToMinutes(entry.end_time)
          : start + (index + 1) * lessonDuration,
      ),
    }));
  });
}

function inferCommonLessonDuration(entries: ScheduleImportEntry[]) {
  const counts = new Map<number, number>();

  for (const entry of entries) {
    const duration =
      timeToMinutes(entry.end_time) - timeToMinutes(entry.start_time);
    if (duration < 30 || duration > 75) continue;
    counts.set(duration, (counts.get(duration) ?? 0) + 1);
  }

  return (
    [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] ??
    null
  );
}

function dedupeScheduleEntries(entries: ScheduleImportEntry[]) {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = scheduleImportEntryKey(entry);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function placeExtendedEssayAfterThursdayMath(entries: ScheduleImportEntry[]) {
  const thursdayMath = entries
    .filter(
      (entry) =>
        entry.weekday === 4 && /\bmath(?:ematics)?\b/i.test(entry.subject),
    )
    .sort((a, b) => a.end_time.localeCompare(b.end_time))
    .at(-1);

  return entries.map((entry) => {
    if (entry.subject !== "Extended Essay") return entry;

    if (!thursdayMath) {
      return { ...entry, weekday: 4 };
    }

    const duration = Math.max(
      30,
      timeToMinutes(entry.end_time) - timeToMinutes(entry.start_time),
    );
    const startMinutes = timeToMinutes(thursdayMath.end_time);
    const endMinutes = Math.min(startMinutes + duration, 24 * 60 - 1);

    return {
      ...entry,
      weekday: 4,
      start_time: thursdayMath.end_time,
      end_time: minutesToTime(endMinutes),
    };
  });
}

function scheduleImportEntryKey(entry: ScheduleImportEntry) {
  return [
    entry.weekday,
    entry.subject.toLowerCase(),
    entry.start_time,
    entry.end_time,
    entry.room?.toLowerCase() ?? "",
    entry.teacher?.toLowerCase() ?? "",
  ].join("|");
}
