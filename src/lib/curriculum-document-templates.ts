export const CURRICULUM_DOCUMENT_TEMPLATE_TYPES = [
  "subject_notes",
  "ia",
  "ee",
  "tok_exhibition",
  "tok_essay",
  "cas_portfolio",
] as const;

export type CurriculumDocumentTemplateType =
  (typeof CURRICULUM_DOCUMENT_TEMPLATE_TYPES)[number];

export type CurriculumDocumentOwnerType =
  | "subject"
  | "ia"
  | "ee"
  | "tok"
  | "cas";

export type CurriculumDocumentTemplateContext = {
  title: string;
  subjectName?: string | null;
  level?: string | null;
  researchQuestion?: string | null;
  supervisor?: string | null;
  prescribedTitle?: string | null;
  exhibitionObjects?: Array<{
    title?: string | null;
    description?: string | null;
  }> | null;
};

const DEFAULT_TEMPLATE_BY_OWNER: Record<
  CurriculumDocumentOwnerType,
  CurriculumDocumentTemplateType
> = {
  subject: "subject_notes",
  ia: "ia",
  ee: "ee",
  tok: "tok_essay",
  cas: "cas_portfolio",
};

const OWNER_TEMPLATE_TYPES: Record<
  CurriculumDocumentOwnerType,
  CurriculumDocumentTemplateType[]
> = {
  subject: ["subject_notes"],
  ia: ["ia"],
  ee: ["ee"],
  tok: ["tok_essay", "tok_exhibition"],
  cas: ["cas_portfolio"],
};

export function defaultTemplateTypeForOwner(
  ownerType: CurriculumDocumentOwnerType,
) {
  return DEFAULT_TEMPLATE_BY_OWNER[ownerType];
}

export function isCurriculumDocumentTemplateType(
  value: unknown,
): value is CurriculumDocumentTemplateType {
  return (
    typeof value === "string" &&
    CURRICULUM_DOCUMENT_TEMPLATE_TYPES.includes(
      value as CurriculumDocumentTemplateType,
    )
  );
}

export function normalizeCurriculumDocumentTemplateType(
  value: unknown,
  fallback: CurriculumDocumentTemplateType,
) {
  return isCurriculumDocumentTemplateType(value) ? value : fallback;
}

export function isTemplateAllowedForOwner(
  ownerType: CurriculumDocumentOwnerType,
  templateType: CurriculumDocumentTemplateType,
) {
  return OWNER_TEMPLATE_TYPES[ownerType].includes(templateType);
}

export function buildCurriculumDocumentTemplate(
  templateType: CurriculumDocumentTemplateType,
  context: CurriculumDocumentTemplateContext,
) {
  const title = clean(context.title, "Untitled document");

  switch (templateType) {
    case "subject_notes":
      return [
        title,
        "",
        `Subject: ${clean(context.subjectName, "Subject")}`,
        `Level: ${clean(context.level, "HL/SL")}`,
        "",
        "Syllabus links",
        "- Topic:",
        "- Assessment objective:",
        "",
        "Class notes",
        "",
        "Questions to revisit",
        "- ",
      ].join("\n");

    case "ia":
      return [
        title,
        "",
        `Subject: ${clean(context.subjectName, "Subject")}`,
        "",
        "Research question",
        clean(context.researchQuestion, ""),
        "",
        "Method and data",
        "- ",
        "",
        "Draft notes",
        "- ",
      ].join("\n");

    case "ee":
      return [
        title,
        "",
        `Subject: ${clean(context.subjectName, "")}`,
        `Supervisor: ${clean(context.supervisor, "")}`,
        "",
        "Research question",
        clean(context.researchQuestion, ""),
        "",
        "Argument map",
        "- Claim:",
        "- Evidence:",
        "- Counterpoint:",
        "",
        "Reflection notes",
        "- ",
      ].join("\n");

    case "tok_exhibition":
      return [
        title,
        "",
        "Prompt",
        clean(context.prescribedTitle, ""),
        "",
        "Objects",
        ...formatTokObjects(context.exhibitionObjects),
        "",
        "Commentary",
        "- ",
      ].join("\n");

    case "tok_essay":
      return [
        title,
        "",
        "Prescribed title",
        clean(context.prescribedTitle, ""),
        "",
        "Knowledge question",
        "- ",
        "",
        "Areas of knowledge",
        "- ",
        "",
        "Claims and counterclaims",
        "- ",
      ].join("\n");

    case "cas_portfolio":
      return [
        title,
        "",
        "Creativity",
        "- ",
        "",
        "Activity",
        "- ",
        "",
        "Service",
        "- ",
        "",
        "Reflection log",
        "- Date:",
      ].join("\n");
  }
}

function clean(value: string | null | undefined, fallback: string) {
  const text = value?.trim();
  return text ? text : fallback;
}

function formatTokObjects(
  objects: CurriculumDocumentTemplateContext["exhibitionObjects"],
) {
  const normalized = Array.from({ length: 3 }, (_, index) => {
    const item = objects?.[index];
    const title = clean(item?.title, `Object ${index + 1}`);
    const description = clean(item?.description, "");
    return [`${index + 1}. ${title}`, description ? `   ${description}` : ""]
      .filter(Boolean)
      .join("\n");
  });
  return normalized;
}
