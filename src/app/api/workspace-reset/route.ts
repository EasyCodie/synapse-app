import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { createClient, getLocalDb, writeLocalDb } from "@/lib/local/client";

const UPLOAD_DIR = path.join(process.cwd(), ".synapse-data", "uploads");

/**
 * Tables that hold user-scoped workspace data.
 * Everything here is wiped on reset; `profiles` is preserved
 * (only its flags are updated).
 */
const RESETTABLE_TABLES = [
  "user_subjects",
  "workspaces",
  "notes",
  "syllabus_progress",
  "internal_assessments",
  "tasks",
  "milestones",
  "resources",
  "chat_conversations",
  "chat_messages",
  "embeddings",
  "ee_tracker",
  "tok_tracker",
  "cas_experiences",
  "flashcards",
] as const;

export async function POST() {
  const local = await createClient();
  const {
    data: { user },
  } = await local.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Wipe all user-scoped tables
    const db = await getLocalDb();
    for (const table of RESETTABLE_TABLES) {
      if (Array.isArray(db[table])) {
        db[table] = [];
      }
    }

    // 2. Reset the profile (keep the row, clear onboarding state)
    const profiles = db.profiles ?? [];
    for (const profile of profiles) {
      if (profile.id === user.id) {
        profile.onboarding_complete = false;
        profile.exam_session = null;
      }
    }

    await writeLocalDb(db);

    // 3. Delete all uploaded files
    try {
      await fs.rm(UPLOAD_DIR, { recursive: true, force: true });
      await fs.mkdir(UPLOAD_DIR, { recursive: true });
    } catch {
      // Upload dir may not exist — that's fine
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Workspace reset failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
