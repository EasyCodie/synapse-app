import { NextResponse } from "next/server";
import { createClient } from "@/lib/local/client";
import { ensureCurriculumScaffold } from "@/lib/curriculum";
import { generateAllWorkspaces, type SubjectSelection } from "@/lib/workspace-generator";

export async function GET() {
  const local = await createClient();
  const {
    data: { user },
  } = await local.auth.getUser();

  const { data: profile, error } = await local
    .from("profiles")
    .select("onboarding_complete")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    examSession?: unknown;
    selectedSubjects?: unknown;
  };
  const examSession = typeof body.examSession === "string" ? body.examSession : "";
  const selectedSubjects = Array.isArray(body.selectedSubjects)
    ? (body.selectedSubjects as SubjectSelection[])
    : [];

  if (!examSession || selectedSubjects.length !== 6) {
    return NextResponse.json(
      { error: "Exam session and six subjects are required." },
      { status: 400 }
    );
  }

  const local = await createClient();
  const {
    data: { user },
  } = await local.auth.getUser();

  const subjectRows = selectedSubjects.map((subject) => ({
    user_id: user.id,
    subject_key: subject.id,
    subject_name: subject.name,
    subject_group: subject.group,
    level: subject.level,
    language: subject.language,
  }));

  const { data: insertedSubjects, error: subjectsError } = await local
    .from("user_subjects")
    .upsert(subjectRows, { onConflict: "user_id,subject_name" })
    .select("id, subject_name");

  if (subjectsError) {
    return NextResponse.json({ error: subjectsError.message }, { status: 500 });
  }

  const subjectIdByName = new Map(
    ((insertedSubjects ?? []) as Array<{ id: string; subject_name: string }>).map(
      (subject) => [subject.subject_name, subject.id]
    )
  );
  const workspaces = generateAllWorkspaces(selectedSubjects);
  const workspaceRows = workspaces.map((workspace) => ({
    user_id: user.id,
    subject_id: subjectIdByName.get(workspace.subjectName) ?? null,
    structure: workspace as unknown as Record<string, unknown>,
  }));

  if (workspaceRows.some((row) => !row.subject_id)) {
    return NextResponse.json(
      { error: "Could not match every selected subject to a workspace." },
      { status: 500 }
    );
  }

  const { error: workspaceError } = await local
    .from("workspaces")
    .upsert(workspaceRows, { onConflict: "user_id,subject_id" });

  if (workspaceError) {
    return NextResponse.json({ error: workspaceError.message }, { status: 500 });
  }

  const { error: profileError } = await local.from("profiles").upsert({
    id: user.id,
    exam_session: examSession,
    onboarding_complete: true,
    full_name: user.user_metadata?.["full_name"] ?? null,
  });

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  await ensureCurriculumScaffold(user.id);

  return NextResponse.json({ success: true });
}
