import { NextRequest, NextResponse } from "next/server";
import {
  buildCurriculumDocumentTemplate,
  defaultTemplateTypeForOwner,
  isTemplateAllowedForOwner,
  normalizeCurriculumDocumentTemplateType,
  type CurriculumDocumentTemplateContext,
} from "@/lib/curriculum-document-templates";
import {
  createCurriculumGoogleDoc,
  getExistingGoogleDocumentMetadata,
  GoogleDriveError,
  parseGoogleDocumentId,
  type CurriculumDocumentSelectionMethod,
  type CurriculumOwnerType,
} from "@/lib/google-drive";
import { createClient } from "@/lib/local/client";

const OWNER_TYPES = new Set(["subject", "ia", "ee", "tok", "cas"]);
const SELECTION_METHODS = new Set<CurriculumDocumentSelectionMethod>([
  "created",
  "pasted_url",
  "google_picker",
]);

type OwnerContext = {
  ownerType: CurriculumOwnerType;
  ownerId: string;
  subjectId?: string | null;
  fallbackTitle: string;
  folderSegments: string[];
  templateContext: Omit<CurriculumDocumentTemplateContext, "title">;
};

function cleanTitle(value: unknown, fallback: string) {
  const title = typeof value === "string" ? value.trim() : "";
  return title || fallback;
}

function normalizeSelectionMethod(
  value: unknown,
  fallback: CurriculumDocumentSelectionMethod,
) {
  return typeof value === "string" &&
    SELECTION_METHODS.has(value as CurriculumDocumentSelectionMethod)
    ? (value as CurriculumDocumentSelectionMethod)
    : fallback;
}

async function getOwnerContext(
  local: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  ownerType: CurriculumOwnerType,
  ownerId: string,
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
      templateContext: {
        subjectName,
        level: typeof subject.level === "string" ? subject.level : null,
      },
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
      templateContext: {
        subjectName,
        researchQuestion:
          typeof ia.research_question === "string"
            ? ia.research_question
            : null,
      },
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
      templateContext: {
        subjectName: typeof ee.subject === "string" ? ee.subject : null,
        supervisor: typeof ee.supervisor === "string" ? ee.supervisor : null,
        researchQuestion:
          typeof ee.research_question === "string"
            ? ee.research_question
            : null,
      },
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
      templateContext: {
        prescribedTitle:
          typeof tok.prescribed_title === "string"
            ? tok.prescribed_title
            : null,
        exhibitionObjects: Array.isArray(tok.exhibition_objects)
          ? tok.exhibition_objects
          : null,
      },
    };
  }

  return {
    ownerType: "cas",
    ownerId: "cas",
    fallbackTitle: "CAS Portfolio",
    folderSegments: ["Core", "CAS"],
    templateContext: {},
  };
}

async function findDuplicateDocument(
  local: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  ownerType: CurriculumOwnerType,
  ownerId: string,
  documentId: string,
) {
  const { data } = await local
    .from("curriculum_documents")
    .select("id,title,document_url")
    .eq("user_id", userId)
    .eq("owner_type", ownerType)
    .eq("owner_id", ownerId)
    .eq("document_id", documentId)
    .maybeSingle();
  return data;
}

function jsonError(error: unknown, fallback: string) {
  if (error instanceof GoogleDriveError) {
    const status =
      error.code === "document_not_google_doc"
        ? 400
        : error.code === "document_inaccessible"
          ? 403
          : error.code === "google_not_configured"
            ? 503
            : error.code === "google_not_connected"
              ? 409
              : 500;

    return NextResponse.json(
      { error: error.message, code: error.code },
      { status },
    );
  }

  return NextResponse.json(
    { error: error instanceof Error ? error.message : fallback },
    { status: 500 },
  );
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
    return NextResponse.json(
      { error: "Valid owner is required" },
      { status: 400 },
    );
  }

  const context = await getOwnerContext(local, user.id, ownerType, ownerId);
  if (!context)
    return NextResponse.json({ error: "Owner not found" }, { status: 404 });

  const fallbackTemplateType = defaultTemplateTypeForOwner(context.ownerType);
  const templateType = normalizeCurriculumDocumentTemplateType(
    body.template_type,
    fallbackTemplateType,
  );

  if (!isTemplateAllowedForOwner(context.ownerType, templateType)) {
    return NextResponse.json(
      { error: "Template type does not match this curriculum owner" },
      { status: 400 },
    );
  }

  const title = cleanTitle(body.title, context.fallbackTitle);

  try {
    if (mode === "link") {
      const documentInput =
        typeof body.document_id === "string" && body.document_id.trim()
          ? body.document_id
          : typeof body.document_url === "string"
            ? body.document_url
            : "";
      const documentId = parseGoogleDocumentId(documentInput);
      if (!documentId) {
        return NextResponse.json(
          { error: "Select or paste a valid Google Docs document" },
          { status: 400 },
        );
      }

      const existing = await findDuplicateDocument(
        local,
        user.id,
        context.ownerType,
        context.ownerId,
        documentId,
      );
      if (existing) {
        return NextResponse.json(
          { error: "This Google document is already linked here" },
          { status: 409 },
        );
      }

      const metadata = await getExistingGoogleDocumentMetadata(
        user.id,
        documentId,
      );
      const now = new Date().toISOString();
      const fallbackSelectionMethod =
        typeof body.document_id === "string" && body.document_id.trim()
          ? "google_picker"
          : "pasted_url";
      const selectionMethod = normalizeSelectionMethod(
        body.selection_method,
        fallbackSelectionMethod,
      );
      const { data } = await local
        .from("curriculum_documents")
        .insert({
          user_id: user.id,
          owner_type: context.ownerType,
          owner_id: context.ownerId,
          subject_id: context.subjectId ?? null,
          title: metadata.title,
          document_id: metadata.documentId,
          document_url: metadata.documentUrl,
          folder_id: null,
          source: "google_drive",
          template_type: templateType,
          selection_method:
            selectionMethod === "created"
              ? fallbackSelectionMethod
              : selectionMethod,
          mime_type: metadata.mimeType,
          last_opened_at: null,
          last_synced_at: now,
          created_at: now,
          updated_at: now,
        })
        .select("*")
        .single();

      return NextResponse.json({ document: data });
    }

    const seedText = buildCurriculumDocumentTemplate(templateType, {
      ...context.templateContext,
      title,
    });
    const document = await createCurriculumGoogleDoc({
      userId: user.id,
      ownerType: context.ownerType,
      ownerId: context.ownerId,
      subjectId: context.subjectId ?? null,
      title,
      folderSegments: context.folderSegments,
      seedText,
      templateType,
      selectionMethod: "created",
    });
    return NextResponse.json({ document });
  } catch (error) {
    return jsonError(error, "Could not create document");
  }
}

export async function PATCH(request: NextRequest) {
  const local = await createClient();
  const {
    data: { user },
  } = await local.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as Record<string, unknown>;
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const now = new Date().toISOString();
  const { data } = await local
    .from("curriculum_documents")
    .update({ last_opened_at: now, updated_at: now })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .maybeSingle();

  if (!data)
    return NextResponse.json({ error: "Document not found" }, { status: 404 });

  return NextResponse.json({ document: data });
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
