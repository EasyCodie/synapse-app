import { NextRequest, NextResponse } from "next/server";
import {
  createCurriculumGoogleDoc,
  getExistingGoogleDocumentTitle,
  parseGoogleDocumentId,
  type CurriculumOwnerType,
} from "@/lib/google-drive";
import { createClient } from "@/lib/local/client";

const OWNER_TYPES = new Set(["subject", "ia", "ee", "tok", "cas"]);

type OwnerContext = {
  ownerType: CurriculumOwnerType;
  ownerId: string;
  subjectId?: string | null;
  fallbackTitle: string;
  folderSegments: string[];
  seedText: string;
};

function cleanTitle(value: unknown, fallback: string) {
  const title = typeof value === "string" ? value.trim() : "";
  return title || fallback;
}

async function getOwnerContext(
  local: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  ownerType: CurriculumOwnerType,
  ownerId: string
): Promise<OwnerContext | null> {
  if (ownerType === "subject") {
    const { data: subject } = await local
      .from("user_subjects")
      .select("id, subject_name, level")
      .eq("id", ownerId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!subject) return null;
    const subjectName = String(subject.subject_name ?? "Subject");
    return {
      ownerType,
      ownerId,
      subjectId: subject.id,
      fallbackTitle: `${subjectName} Notes`,
      folderSegments: ["Subjects", subjectName, "Notes"],
      seedText: `${subjectName} Notes\n\nKey syllabus links:\n\nQuestions to revisit:\n`,
    };
  }

  if (ownerType === "ia") {
    const { data: ia } = await local
      .from("internal_assessments")
      .select("*")
      .eq("id", ownerId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!ia) return null;
    const { data: subject } = await local
      .from("user_subjects")
      .select("id, subject_name")
      .eq("id", ia.subject_id)
      .eq("user_id", userId)
      .maybeSingle();
    const subjectName = String(subject?.subject_name ?? "Subject");
    const title = String(ia.title ?? `${subjectName} IA`);
    return {
      ownerType,
      ownerId,
      subjectId: subject?.id ?? ia.subject_id ?? null,
      fallbackTitle: title,
      folderSegments: ["Subjects", subjectName, "IA"],
      seedText: `${title}\n\nResearch question:\n${ia.research_question ?? ""}\n\nDraft notes:\n`,
    };
  }

  if (ownerType === "ee") {
    const { data: ee } = await local
      .from("ee_tracker")
      .select("*")
      .eq("id", ownerId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!ee) return null;
    const title = String(ee.title || "Extended Essay");
    return {
      ownerType,
      ownerId,
      fallbackTitle: title,
      folderSegments: ["Core", "Extended Essay"],
      seedText: `${title}\n\nSubject: ${ee.subject ?? ""}\nSupervisor: ${ee.supervisor ?? ""}\n\nResearch question:\n${ee.research_question ?? ""}\n`,
    };
  }

  if (ownerType === "tok") {
    const { data: tok } = await local
      .from("tok_tracker")
      .select("*")
      .eq("id", ownerId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!tok) return null;
    const title = String(tok.essay_title || "Theory of Knowledge");
    return {
      ownerType,
      ownerId,
      fallbackTitle: title,
      folderSegments: ["Core", "Theory of Knowledge"],
      seedText: `${title}\n\nPrescribed title:\n${tok.prescribed_title ?? ""}\n\nExhibition objects:\n`,
    };
  }

  return {
    ownerType: "cas",
    ownerId: "cas",
    fallbackTitle: "CAS Portfolio",
    folderSegments: ["Core", "CAS"],
    seedText: "CAS Portfolio\n\nCreativity:\n\nActivity:\n\nService:\n\nReflections:\n",
  };
}

export async function POST(request: NextRequest) {
  const local = await createClient();
  const {
    data: { user },
  } = await local.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as Record<string, unknown>;
  const ownerType = body.owner_type as CurriculumOwnerType;
  const ownerId = typeof body.owner_id === "string" ? body.owner_id : "";
  const mode = body.mode === "link" ? "link" : "create";

  if (!OWNER_TYPES.has(ownerType) || !ownerId) {
    return NextResponse.json({ error: "Valid owner is required" }, { status: 400 });
  }

  const context = await getOwnerContext(local, user.id, ownerType, ownerId);
  if (!context) return NextResponse.json({ error: "Owner not found" }, { status: 404 });

  const title = cleanTitle(body.title, context.fallbackTitle);

  try {
    if (mode === "link") {
      const documentUrl = typeof body.document_url === "string" ? body.document_url.trim() : "";
      const documentId = parseGoogleDocumentId(documentUrl);
      if (!documentId) {
        return NextResponse.json(
          { error: "Paste a valid Google Docs URL" },
          { status: 400 }
        );
      }

      const linkedTitle = await getExistingGoogleDocumentTitle(user.id, documentId);
      const now = new Date().toISOString();
      const { data } = await local.from("curriculum_documents").insert({
        user_id: user.id,
        owner_type: context.ownerType,
        owner_id: context.ownerId,
        subject_id: context.subjectId ?? null,
        title: linkedTitle,
        document_id: documentId,
        document_url: `https://docs.google.com/document/d/${documentId}/edit`,
        folder_id: null,
        source: "google_drive",
        created_at: now,
        updated_at: now,
      }).select("*").single();

      return NextResponse.json({ document: data });
    }

    const document = await createCurriculumGoogleDoc({
      userId: user.id,
      ownerType: context.ownerType,
      ownerId: context.ownerId,
      subjectId: context.subjectId ?? null,
      title,
      folderSegments: context.folderSegments,
      seedText: context.seedText,
    });
    return NextResponse.json({ document });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create document" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const local = await createClient();
  const {
    data: { user },
  } = await local.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  await local
    .from("curriculum_documents")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}
