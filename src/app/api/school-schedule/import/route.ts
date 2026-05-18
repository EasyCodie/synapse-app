import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/local/client";
import {
  sortScheduleEntries,
  type CalendarSubject,
  type SchoolScheduleEntry,
} from "@/lib/school-schedule";
import {
  analyzeScheduleImportWithAi,
  SCHEDULE_IMPORT_AI_MODEL,
} from "@/lib/schedule-import-ai";
import {
  parseScheduleWorkbook,
  readScheduleImportWorkbook,
  type ScheduleImportEntry,
  type ScheduleImportParseResult,
} from "@/lib/schedule-import";

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
const SCHEDULE_COLUMNS =
  "id, weekday, subject, subject_id, start_time, end_time, room, teacher, created_at, updated_at";

const ACCEPTED_EXTENSIONS = [".xlsx", ".csv"];
const ACCEPTED_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "application/octet-stream",
  "application/zip",
  "",
]);

export async function POST(request: NextRequest) {
  const local = await createClient();
  const {
    data: { user },
  } = await local.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const replace = formData.get("replace") === "true";

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Schedule file is required." },
      { status: 400 },
    );
  }

  if (!isAcceptedFile(file)) {
    return NextResponse.json(
      { error: "Upload a .xlsx or .csv schedule file." },
      { status: 400 },
    );
  }

  if (file.size > MAX_IMPORT_BYTES) {
    return NextResponse.json(
      { error: "Schedule imports must be 5MB or smaller." },
      { status: 400 },
    );
  }

  const { data: subjectData, error: subjectsError } = await local
    .from("user_subjects")
    .select("id, subject_name, level")
    .eq("user_id", user.id)
    .limit(100);

  if (subjectsError) {
    return NextResponse.json({ error: subjectsError.message }, { status: 500 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let parsed: ScheduleImportParseResult;
  let processor: "ai" | "deterministic" = "deterministic";
  let model: string | null = null;

  try {
    const subjects = (subjectData ?? []) as CalendarSubject[];
    const workbook = await readScheduleImportWorkbook(buffer, file.name);
    const deterministicParsed = parseScheduleWorkbook(workbook, subjects);
    parsed = deterministicParsed;

    if (process.env.OPENAI_API_KEY) {
      try {
        const aiParsed = await analyzeScheduleImportWithAi({
          workbook,
          subjects,
          deterministicResult: deterministicParsed,
        });

        model = aiParsed.model;
        if (aiParsed.entries.length > 0) {
          parsed = {
            entries: aiParsed.entries,
            issues: aiParsed.issues,
          };
          processor = "ai";
        } else if (deterministicParsed.entries.length === 0) {
          parsed = {
            entries: [],
            issues: aiParsed.issues,
          };
          processor = "ai";
        } else {
          parsed = {
            entries: deterministicParsed.entries,
            issues: [
              {
                row: 0,
                message:
                  "AI cleanup could not produce valid classes, so the fallback parser was used.",
              },
              ...deterministicParsed.issues,
            ],
          };
        }
      } catch (error) {
        console.error("AI schedule import cleanup failed:", error);
        parsed = {
          entries: deterministicParsed.entries,
          issues: [
            {
              row: 0,
              message:
                "AI cleanup failed, so the fallback schedule parser was used.",
            },
            ...deterministicParsed.issues,
          ],
        };
        model = SCHEDULE_IMPORT_AI_MODEL;
      }
    } else {
      parsed = {
        entries: deterministicParsed.entries,
        issues: [
          {
            row: 0,
            message:
              "AI cleanup is unavailable because OPENAI_API_KEY is not configured; the fallback parser was used.",
          },
          ...deterministicParsed.issues,
        ],
      };
    }
  } catch {
    return NextResponse.json(
      { error: "Could not read this schedule file." },
      { status: 400 },
    );
  }

  if (parsed.entries.length === 0) {
    return NextResponse.json(
      {
        error: "No schedule rows could be imported.",
        issues: parsed.issues.slice(0, 25),
        processor,
        model,
      },
      { status: 400 },
    );
  }

  let entriesToInsert = parsed.entries;
  let skippedDuplicates = 0;

  if (!replace) {
    const { data: existingData, error: existingError } = await local
      .from("school_schedule_entries")
      .select(SCHEDULE_COLUMNS)
      .eq("user_id", user.id)
      .limit(500);

    if (existingError) {
      return NextResponse.json(
        { error: existingError.message },
        { status: 500 },
      );
    }

    const existingKeys = new Set(
      ((existingData ?? []) as SchoolScheduleEntry[]).map(scheduleEntryKey),
    );
    entriesToInsert = parsed.entries.filter((entry) => {
      const duplicate = existingKeys.has(scheduleEntryKey(entry));
      if (duplicate) skippedDuplicates++;
      return !duplicate;
    });
  }

  if (entriesToInsert.length === 0) {
    return NextResponse.json({
      entries: [],
      imported: 0,
      skipped_duplicates: skippedDuplicates,
      issues: parsed.issues.slice(0, 25),
      processor,
      model,
    });
  }

  if (replace) {
    const { error: deleteError } = await local
      .from("school_schedule_entries")
      .delete()
      .eq("user_id", user.id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }
  }

  const { data, error } = await local
    .from("school_schedule_entries")
    .insert(entriesToInsert.map((entry) => ({ user_id: user.id, ...entry })))
    .select(SCHEDULE_COLUMNS);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      entries: sortScheduleEntries((data ?? []) as SchoolScheduleEntry[]),
      imported: data?.length ?? 0,
      skipped_duplicates: skippedDuplicates,
      issues: parsed.issues.slice(0, 25),
      processor,
      model,
    },
    { status: 201 },
  );
}

function isAcceptedFile(file: File) {
  const lowerName = file.name.toLowerCase();
  return (
    ACCEPTED_EXTENSIONS.some((extension) => lowerName.endsWith(extension)) &&
    ACCEPTED_MIME_TYPES.has(file.type)
  );
}

function scheduleEntryKey(entry: ScheduleImportEntry | SchoolScheduleEntry) {
  return [
    entry.weekday,
    entry.subject.toLowerCase(),
    entry.start_time,
    entry.end_time,
    entry.room?.toLowerCase() ?? "",
    entry.teacher?.toLowerCase() ?? "",
  ].join("|");
}
