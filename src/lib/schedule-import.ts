import JSZip from "jszip";
import {
  isValidTime,
  isValidWeekday,
  timeToMinutes,
  type CalendarSubject,
} from "@/lib/school-schedule";
import { displaySubjectName } from "@/lib/subject-display";

export type ScheduleImportEntry = {
  weekday: number;
  subject: string;
  subject_id: string | null;
  start_time: string;
  end_time: string;
  room: string | null;
  teacher: string | null;
};

export type ScheduleImportIssue = {
  row: number;
  message: string;
};

export type ScheduleImportSheet = {
  name: string;
  rows: string[][];
};

export type ScheduleImportWorkbook = {
  fileName: string;
  sheets: ScheduleImportSheet[];
};

export type ScheduleImportParseResult = {
  entries: ScheduleImportEntry[];
  issues: ScheduleImportIssue[];
};

const DAY_ALIASES = new Set(["day", "weekday", "week day", "date"]);
const SUBJECT_ALIASES = new Set([
  "subject",
  "class",
  "course",
  "lesson",
  "title",
  "name",
]);
const START_ALIASES = new Set([
  "start",
  "start time",
  "from",
  "begins",
  "begin",
]);
const END_ALIASES = new Set(["end", "end time", "to", "finishes", "finish"]);
const TIME_ALIASES = new Set(["time", "period", "lesson time", "slot"]);
const ROOM_ALIASES = new Set(["room", "location", "venue", "classroom"]);
const TEACHER_ALIASES = new Set(["teacher", "instructor", "tutor", "staff"]);

export async function parseScheduleImportFile(
  buffer: Buffer,
  fileName: string,
  subjects: CalendarSubject[],
): Promise<ScheduleImportParseResult> {
  const workbook = await readScheduleImportWorkbook(buffer, fileName);
  return parseScheduleWorkbook(workbook, subjects);
}

export async function readScheduleImportWorkbook(
  buffer: Buffer,
  fileName: string,
): Promise<ScheduleImportWorkbook> {
  const lowerName = fileName.toLowerCase();
  const sheets = lowerName.endsWith(".csv")
    ? [{ name: "Schedule", rows: parseCsvRows(buffer.toString("utf8")) }]
    : await parseXlsxSheets(buffer);

  return { fileName, sheets };
}

export function parseScheduleWorkbook(
  workbook: ScheduleImportWorkbook,
  subjects: CalendarSubject[],
): ScheduleImportParseResult {
  const entries: ScheduleImportEntry[] = [];
  const issues: ScheduleImportIssue[] = [];
  const sheetFailures: ScheduleImportIssue[] = [];
  const seen = new Set<string>();

  for (const sheet of workbook.sheets) {
    const parsed = parseScheduleRows(sheet.rows, subjects);
    const targetIssues = parsed.entries.length > 0 ? issues : sheetFailures;

    targetIssues.push(
      ...parsed.issues.map((issue) => ({
        row: issue.row,
        message: `${sheet.name}: ${issue.message}`,
      })),
    );

    for (const entry of parsed.entries) {
      const key = scheduleImportEntryKey(entry);
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push(entry);
    }
  }

  return {
    entries,
    issues: entries.length > 0 ? issues : sheetFailures,
  };
}

export function parseScheduleRows(
  rows: string[][],
  subjects: CalendarSubject[],
): ScheduleImportParseResult {
  const compactRows = rows
    .map((row) => row.map((value) => cleanCell(value)))
    .filter((row) => row.some(Boolean));

  const rowList = parseRowListSchedule(compactRows, subjects);
  if (rowList.entries.length > 0) return rowList;

  return parseGridSchedule(compactRows, subjects);
}

function parseRowListSchedule(
  rows: string[][],
  subjects: CalendarSubject[],
): ScheduleImportParseResult {
  const headerIndex = rows.findIndex(
    (row, index) => index < 10 && looksLikeHeader(row),
  );
  if (headerIndex < 0) return { entries: [], issues: [] };

  const headers = rows[headerIndex]!.map(normalizeHeader);
  const dayIndex = findHeader(headers, DAY_ALIASES);
  const subjectIndex = findHeader(headers, SUBJECT_ALIASES);
  const startIndex = findHeader(headers, START_ALIASES);
  const endIndex = findHeader(headers, END_ALIASES);
  const timeIndex = findHeader(headers, TIME_ALIASES);
  const roomIndex = findHeader(headers, ROOM_ALIASES);
  const teacherIndex = findHeader(headers, TEACHER_ALIASES);

  const entries: ScheduleImportEntry[] = [];
  const issues: ScheduleImportIssue[] = [];

  rows.slice(headerIndex + 1).forEach((row, offset) => {
    const rowNumber = headerIndex + offset + 2;
    const weekday = normalizeScheduleWeekday(row[dayIndex] ?? "");
    const rawSubject = cleanCell(row[subjectIndex] ?? "");
    const subjectId = matchScheduleSubjectId(rawSubject, subjects);
    const subject = normalizeScheduleSubjectName(rawSubject, subjects);
    const room = roomIndex >= 0 ? cleanOptional(row[roomIndex]) : null;
    const teacher = teacherIndex >= 0 ? cleanOptional(row[teacherIndex]) : null;

    const timeRange =
      timeIndex >= 0 ? normalizeScheduleTimeRange(row[timeIndex] ?? "") : null;
    const startTime =
      normalizeScheduleTime(row[startIndex] ?? "") ?? timeRange?.start ?? null;
    const endTime =
      normalizeScheduleTime(row[endIndex] ?? "") ?? timeRange?.end ?? null;

    const issue = validateEntryParts(
      rowNumber,
      weekday,
      subject,
      startTime,
      endTime,
    );
    if (issue) {
      issues.push(issue);
      return;
    }
    if (weekday === null || !startTime || !endTime) return;

    entries.push({
      weekday,
      subject,
      subject_id: subjectId,
      start_time: startTime,
      end_time: endTime,
      room,
      teacher,
    });
  });

  return { entries, issues };
}

function parseGridSchedule(
  rows: string[][],
  subjects: CalendarSubject[],
): ScheduleImportParseResult {
  const headerIndex = rows.findIndex(
    (row, index) =>
      index < 10 &&
      (row.filter((cell) => normalizeScheduleWeekday(cell) !== null).length >=
        2 ||
        (row.filter((cell) => normalizeScheduleWeekday(cell) !== null).length >=
          1 &&
          row.some((cell) => TIME_ALIASES.has(normalizeHeader(cell))))),
  );

  if (headerIndex < 0) {
    return {
      entries: [],
      issues: [
        {
          row: 0,
          message: "Could not find schedule columns or weekday headers.",
        },
      ],
    };
  }

  const header = rows[headerIndex]!;
  const dayColumns = header
    .map((cell, index) => ({
      index,
      weekday: normalizeScheduleWeekday(cell),
    }))
    .filter(
      (item): item is { index: number; weekday: number } =>
        item.weekday !== null,
    );
  const entries: ScheduleImportEntry[] = [];
  const issues: ScheduleImportIssue[] = [];

  rows.slice(headerIndex + 1).forEach((row, offset) => {
    const rowNumber = headerIndex + offset + 2;
    const timeCell =
      row.find((cell) => normalizeScheduleTimeRange(cell) !== null) ??
      row[0] ??
      "";
    const timeRange = normalizeScheduleTimeRange(timeCell);

    if (!timeRange) {
      if (row.some(Boolean)) {
        issues.push({
          row: rowNumber,
          message: "Skipped row without a valid time range.",
        });
      }
      return;
    }

    for (const { index, weekday } of dayColumns) {
      const classText = cleanCell(row[index] ?? "");
      if (!classText) continue;

      const parsed = parseClassCell(classText);
      if (!parsed.subject) continue;
      const subjectId = matchScheduleSubjectId(parsed.subject, subjects);

      entries.push({
        weekday,
        subject: normalizeScheduleSubjectName(parsed.subject, subjects),
        subject_id: subjectId,
        start_time: timeRange.start,
        end_time: timeRange.end,
        room: parsed.room,
        teacher: parsed.teacher,
      });
    }
  });

  return { entries, issues };
}

async function parseXlsxSheets(buffer: Buffer): Promise<ScheduleImportSheet[]> {
  const zip = await JSZip.loadAsync(buffer);
  const sharedStrings = await readSharedStrings(zip);
  const sheetRefs = await findWorksheetRefs(zip);
  const sheets: ScheduleImportSheet[] = [];

  for (const sheet of sheetRefs) {
    const sheetXml = await zip.file(sheet.path)?.async("string");
    if (!sheetXml) continue;

    sheets.push({
      name: sheet.name,
      rows: parseWorksheetRows(sheetXml, sharedStrings),
    });
  }

  if (sheets.length === 0) {
    throw new Error("No worksheet found in this Excel file.");
  }

  return sheets;
}

function parseWorksheetRows(sheetXml: string, sharedStrings: string[]) {
  const rows: string[][] = [];
  const rowRegex = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(sheetXml)) !== null) {
    const cells: string[] = [];
    const cellRegex = /<c\b([^>]*)>([\s\S]*?)<\/c>/g;
    let cellMatch: RegExpExecArray | null;

    while ((cellMatch = cellRegex.exec(rowMatch[1] ?? "")) !== null) {
      const attrs = cellMatch[1] ?? "";
      const body = cellMatch[2] ?? "";
      const ref = getXmlAttribute(attrs, "r");
      const type = getXmlAttribute(attrs, "t");
      const columnIndex = ref ? columnIndexFromRef(ref) : cells.length;
      cells[columnIndex] = readCellValue(body, type, sharedStrings);
    }

    rows.push(cells.map((cell) => cell ?? ""));
  }

  for (const range of extractMergedCellRanges(sheetXml)) {
    const sourceValue = rows[range.startRow]?.[range.startColumn];
    if (!sourceValue) continue;

    for (let row = range.startRow; row <= range.endRow; row++) {
      rows[row] ??= [];
      for (
        let column = range.startColumn;
        column <= range.endColumn;
        column++
      ) {
        rows[row]![column] = rows[row]![column] || sourceValue;
      }
    }
  }

  return rows;
}

function extractMergedCellRanges(sheetXml: string) {
  const ranges: Array<{
    startRow: number;
    endRow: number;
    startColumn: number;
    endColumn: number;
  }> = [];
  const mergeRegex = /<mergeCell\b[^>]*\bref="([^"]+)"[^>]*\/?>/gi;
  let match: RegExpExecArray | null;

  while ((match = mergeRegex.exec(sheetXml)) !== null) {
    const [startRef, endRef] = (match[1] ?? "").split(":");
    const start = startRef ? cellRefToIndexes(startRef) : null;
    const end = endRef ? cellRefToIndexes(endRef) : start;
    if (!start || !end) continue;

    ranges.push({
      startRow: Math.min(start.row, end.row),
      endRow: Math.max(start.row, end.row),
      startColumn: Math.min(start.column, end.column),
      endColumn: Math.max(start.column, end.column),
    });
  }

  return ranges;
}

async function findWorksheetRefs(zip: JSZip) {
  const workbookXml = await zip.file("xl/workbook.xml")?.async("string");
  const relsXml = await zip.file("xl/_rels/workbook.xml.rels")?.async("string");

  if (workbookXml && relsXml) {
    const rels = new Map<string, string>();
    const relRegex = /<Relationship\b([^>]*)\/?>/g;
    let relMatch: RegExpExecArray | null;

    while ((relMatch = relRegex.exec(relsXml)) !== null) {
      const attrs = relMatch[1] ?? "";
      const id = getXmlAttribute(attrs, "Id");
      const target = getXmlAttribute(attrs, "Target");
      if (id && target) rels.set(id, normalizeSheetPath(target));
    }

    const sheets: Array<{ name: string; path: string }> = [];
    const sheetRegex = /<sheet\b([^>]*)\/?>/g;
    let sheetMatch: RegExpExecArray | null;

    while ((sheetMatch = sheetRegex.exec(workbookXml)) !== null) {
      const attrs = sheetMatch[1] ?? "";
      const relId = getXmlAttribute(attrs, "r:id");
      const path = relId ? rels.get(relId) : null;
      if (!path) continue;

      sheets.push({
        name:
          decodeXml(getXmlAttribute(attrs, "name") ?? "") ||
          `Sheet ${sheets.length + 1}`,
        path,
      });
    }

    if (sheets.length > 0) return sheets;
  }

  const fallback = Object.keys(zip.files)
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name))
    .sort()
    .map((path, index) => ({ name: `Sheet ${index + 1}`, path }));

  if (fallback.length === 0) {
    throw new Error("No worksheet found in this Excel file.");
  }
  return fallback;
}

function normalizeSheetPath(target: string) {
  const withoutLeadingSlash = target.replace(/^\/+/, "");
  return withoutLeadingSlash.startsWith("xl/")
    ? withoutLeadingSlash
    : `xl/${withoutLeadingSlash}`;
}

async function readSharedStrings(zip: JSZip) {
  const xml = await zip.file("xl/sharedStrings.xml")?.async("string");
  if (!xml) return [];

  const strings: string[] = [];
  const itemRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null) {
    strings.push(extractTextTags(match[1] ?? "").join(""));
  }

  return strings;
}

function readCellValue(
  body: string,
  type: string | null,
  sharedStrings: string[],
) {
  if (type === "s") {
    const index = Number(extractTagValue(body, "v"));
    return Number.isFinite(index) ? (sharedStrings[index] ?? "") : "";
  }

  if (type === "inlineStr") {
    return extractTextTags(body).join("");
  }

  return decodeXml(
    extractTagValue(body, "v") ?? extractTextTags(body).join(""),
  );
}

function extractTextTags(xml: string) {
  const parts: string[] = [];
  const textRegex = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
  let match: RegExpExecArray | null;

  while ((match = textRegex.exec(xml)) !== null) {
    parts.push(decodeXml(match[1] ?? ""));
  }

  return parts;
}

function extractTagValue(xml: string, tagName: string) {
  return new RegExp(
    `<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`,
    "i",
  ).exec(xml)?.[1];
}

function getXmlAttribute(attrs: string, name: string) {
  return new RegExp(`\\b${name}="([^"]*)"`, "i").exec(attrs)?.[1] ?? null;
}

function decodeXml(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCharCode(parseInt(code, 16)),
    )
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function columnIndexFromRef(ref: string) {
  const letters = /^[A-Z]+/i.exec(ref)?.[0] ?? "";
  return (
    letters
      .toUpperCase()
      .split("")
      .reduce((total, char) => total * 26 + char.charCodeAt(0) - 64, 0) - 1
  );
}

function cellRefToIndexes(ref: string) {
  const match = /^([A-Z]+)(\d+)$/i.exec(ref);
  if (!match) return null;

  return {
    column: columnIndexFromRef(match[1]!),
    row: Number(match[2]) - 1,
  };
}

function parseCsvRows(input: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < input.length; index++) {
    const char = input[index];
    const next = input[index + 1];

    if (char === '"' && quoted && next === '"') {
      value += '"';
      index++;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      row.push(value);
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index++;
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      continue;
    }

    value += char;
  }

  row.push(value);
  rows.push(row);
  return rows;
}

function looksLikeHeader(row: string[]) {
  const headers = row.map(normalizeHeader);
  return (
    findHeader(headers, DAY_ALIASES) >= 0 &&
    findHeader(headers, SUBJECT_ALIASES) >= 0 &&
    (findHeader(headers, TIME_ALIASES) >= 0 ||
      (findHeader(headers, START_ALIASES) >= 0 &&
        findHeader(headers, END_ALIASES) >= 0))
  );
}

function findHeader(headers: string[], aliases: Set<string>) {
  return headers.findIndex((header) => aliases.has(header));
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function cleanCell(value: unknown) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

function cleanOptional(value: unknown) {
  const text = cleanCell(value);
  return text ? text.slice(0, 80) : null;
}

export function normalizeScheduleWeekday(value: unknown) {
  const text = cleanCell(value).toLowerCase();
  if (!text) return null;

  const numeric = Number(text);
  if (Number.isInteger(numeric)) {
    if (numeric === 7) return 0;
    if (isValidWeekday(numeric)) return numeric;
  }

  if (text.includes("mon")) return 1;
  if (text.includes("tue")) return 2;
  if (text.includes("wed")) return 3;
  if (text.includes("thu")) return 4;
  if (text.includes("fri")) return 5;
  if (text.includes("sat")) return 6;
  if (text.includes("sun")) return 0;

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.getDay();
}

export function normalizeScheduleTimeRange(value: unknown) {
  const text = cleanCell(value);
  const parts = text.split(/\s*(?:-|\u2013|\u2014|to)\s*/i).filter(Boolean);
  if (parts.length >= 2) {
    const start = normalizeScheduleTime(parts[0]);
    const end = normalizeScheduleTime(parts[1]);
    if (start && end && timeToMinutes(end) > timeToMinutes(start)) {
      return { start, end };
    }
  }
  return null;
}

export function normalizeScheduleTime(value: unknown) {
  const text = cleanCell(value).toLowerCase();
  if (!text) return null;

  const amPm = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/.exec(text);
  if (amPm) {
    let hours = Number(amPm[1]);
    const minutes = Number(amPm[2] ?? 0);
    if (amPm[3] === "pm" && hours < 12) hours += 12;
    if (amPm[3] === "am" && hours === 12) hours = 0;
    return toValidTime(hours, minutes);
  }

  const clock = /^(\d{1,2})[:.](\d{2})$/.exec(text);
  if (clock) {
    return toValidTime(Number(clock[1]), Number(clock[2]));
  }

  const compact = /^(\d{1,2})(\d{2})$/.exec(text);
  if (compact) {
    return toValidTime(Number(compact[1]), Number(compact[2]));
  }

  const numeric = Number(text);
  if (Number.isFinite(numeric)) {
    if (numeric > 0 && numeric < 1) {
      const totalMinutes = Math.round(numeric * 24 * 60);
      return toValidTime(Math.floor(totalMinutes / 60), totalMinutes % 60);
    }
    if (Number.isInteger(numeric) && numeric >= 0 && numeric <= 23) {
      return toValidTime(numeric, 0);
    }
  }

  return null;
}

function toValidTime(hours: number, minutes: number) {
  const candidate = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  return isValidTime(candidate) ? candidate : null;
}

function validateEntryParts(
  row: number,
  weekday: number | null,
  subject: string,
  startTime: string | null,
  endTime: string | null,
): ScheduleImportIssue | null {
  if (weekday === null)
    return { row, message: "Skipped row without a valid weekday." };
  if (!subject) return { row, message: "Skipped row without a subject." };
  if (!startTime || !endTime)
    return { row, message: "Skipped row without valid start/end times." };
  if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
    return {
      row,
      message: "Skipped row because end time is not after start time.",
    };
  }
  return null;
}

function parseClassCell(value: string) {
  const lines = value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const subject = lines[0]?.slice(0, 80) ?? "";
  let room: string | null = null;
  let teacher: string | null = null;

  for (const line of lines.slice(1)) {
    const lowered = line.toLowerCase();
    if (
      !room &&
      (lowered.startsWith("room") ||
        lowered.startsWith("rm ") ||
        /^[a-z]?\d{2,4}$/i.test(line))
    ) {
      room =
        line
          .replace(/^room\s*:?/i, "")
          .trim()
          .slice(0, 40) || null;
      continue;
    }
    if (!teacher)
      teacher =
        line
          .replace(/^teacher\s*:?/i, "")
          .trim()
          .slice(0, 80) || null;
  }

  return { subject, room, teacher };
}

export function getCalendarSubjectLabel(subject: CalendarSubject) {
  return displaySubjectName(subject.subject_name);
}

export function matchScheduleSubjectId(
  value: string,
  subjects: CalendarSubject[],
) {
  const normalized = normalizeSubject(stripScheduleSubjectLevel(value));
  const match = subjects.find((subject) => {
    const labels = [
      subject.subject_name,
      subject.level ? `${subject.subject_name} ${subject.level}` : null,
    ].filter((label): label is string => Boolean(label));
    return labels.some((label) => normalizeSubject(label) === normalized);
  });

  return match?.id ?? null;
}

export function normalizeScheduleSubjectName(
  value: string,
  subjects: CalendarSubject[],
) {
  const normalized = normalizeSubject(stripScheduleSubjectLevel(value));
  const matched = subjects.find((subject) => {
    const labels = [
      subject.subject_name,
      subject.level ? `${subject.subject_name} ${subject.level}` : null,
    ].filter((label): label is string => Boolean(label));
    return labels.some((label) => normalizeSubject(label) === normalized);
  });

  if (matched) return displaySubjectName(matched.subject_name);

  return displaySubjectName(stripScheduleSubjectLevel(value));
}

function stripScheduleSubjectLevel(value: string) {
  return value
    .replace(/\b(?:HL|SL)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizeSubject(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (
    normalized === "language a" ||
    normalized.startsWith("language a literature") ||
    normalized.startsWith("language a language and literature")
  ) {
    return "english";
  }

  return normalized;
}

function scheduleImportEntryKey(entry: ScheduleImportEntry) {
  return [
    entry.weekday,
    normalizeSubject(entry.subject),
    entry.start_time,
    entry.end_time,
    normalizeSubject(entry.room ?? ""),
    normalizeSubject(entry.teacher ?? ""),
  ].join("|");
}
