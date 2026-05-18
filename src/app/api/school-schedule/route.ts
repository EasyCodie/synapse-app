import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/local/client";
import {
  isValidTime,
  isValidWeekday,
  sortScheduleEntries,
  timeToMinutes,
  type SchoolScheduleEntry,
} from "@/lib/school-schedule";

const SCHEDULE_COLUMNS =
  "id, weekday, subject, subject_id, start_time, end_time, room, teacher, created_at, updated_at";

type ScheduleBody = {
  weekday?: unknown;
  subject?: unknown;
  subject_id?: unknown;
  start_time?: unknown;
  end_time?: unknown;
  room?: unknown;
  teacher?: unknown;
};

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function validateScheduleBody(body: ScheduleBody) {
  const weekday = Number(body.weekday);
  const subject = cleanText(body.subject, 80);
  const subjectId = cleanText(body.subject_id, 80);
  const startTime = typeof body.start_time === "string" ? body.start_time : "";
  const endTime = typeof body.end_time === "string" ? body.end_time : "";

  if (!isValidWeekday(weekday)) {
    return { error: "weekday must be a number from 0 to 6" };
  }
  if (!subject) {
    return { error: "subject is required" };
  }
  if (!isValidTime(startTime) || !isValidTime(endTime)) {
    return { error: "start_time and end_time must use HH:mm format" };
  }
  if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
    return { error: "end_time must be after start_time" };
  }

  return {
    entry: {
      weekday,
      subject,
      subject_id: subjectId,
      start_time: startTime,
      end_time: endTime,
      room: cleanText(body.room, 40),
      teacher: cleanText(body.teacher, 80),
    },
  };
}

export async function GET() {
  const local = await createClient();
  const {
    data: { user },
  } = await local.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await local
    .from("school_schedule_entries")
    .select(SCHEDULE_COLUMNS)
    .eq("user_id", user.id)
    .limit(500);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    entries: sortScheduleEntries((data ?? []) as SchoolScheduleEntry[]),
  });
}

export async function POST(request: NextRequest) {
  const local = await createClient();
  const {
    data: { user },
  } = await local.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = validateScheduleBody((await request.json()) as ScheduleBody);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  if (parsed.entry.subject_id) {
    const { data: subject, error: subjectError } = await local
      .from("user_subjects")
      .select("id")
      .eq("id", parsed.entry.subject_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (subjectError || !subject) {
      return NextResponse.json(
        { error: "subject_id does not belong to this workspace" },
        { status: 400 }
      );
    }
  }

  const { data, error } = await local
    .from("school_schedule_entries")
    .insert({
      user_id: user.id,
      ...parsed.entry,
    })
    .select(SCHEDULE_COLUMNS)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ entry: data }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const local = await createClient();
  const {
    data: { user },
  } = await local.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { error } = await local
    .from("school_schedule_entries")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
