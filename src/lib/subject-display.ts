export function displaySubjectName(value: string | null | undefined) {
  const subject = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

  if (!subject) return "";

  if (/^language\s*a(?:\s*:|\b)/i.test(subject)) {
    return "English";
  }

  return subject;
}
