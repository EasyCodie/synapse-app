import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  parseScheduleImportFile,
  parseScheduleRows,
  readScheduleImportWorkbook,
} from "@/lib/schedule-import";
import { sanitizeAiScheduleImport } from "@/lib/schedule-import-ai";
import type { CalendarSubject } from "@/lib/school-schedule";

const subjects: CalendarSubject[] = [
  { id: "chemistry-id", subject_name: "Chemistry", level: "HL" },
  { id: "economics-id", subject_name: "Economics", level: "SL" },
  { id: "math-id", subject_name: "Math", level: "AA HL" },
  { id: "biology-id", subject_name: "Biology", level: "HL" },
  { id: "english-id", subject_name: "Language A: Literature", level: "HL" },
];

describe("schedule import parsing", () => {
  it("parses row-based CSV schedules", async () => {
    const csv = [
      "Day,Subject,Start,End,Room,Teacher",
      "Monday,Chemistry HL,09:00,09:50,B204,Dr Novak",
      "Tuesday,Economics SL,10:00,10:50,C101,Mr Hale",
    ].join("\n");

    const result = await parseScheduleImportFile(
      Buffer.from(csv),
      "schedule.csv",
      subjects,
    );

    expect(result.issues).toHaveLength(0);
    expect(result.entries).toEqual([
      {
        weekday: 1,
        subject: "Chemistry",
        subject_id: "chemistry-id",
        start_time: "09:00",
        end_time: "09:50",
        room: "B204",
        teacher: "Dr Novak",
      },
      {
        weekday: 2,
        subject: "Economics",
        subject_id: "economics-id",
        start_time: "10:00",
        end_time: "10:50",
        room: "C101",
        teacher: "Mr Hale",
      },
    ]);
  });

  it("parses weekly grid schedules", () => {
    const result = parseScheduleRows(
      [
        ["Time", "Monday", "Tuesday"],
        ["09:00-09:50", "Chemistry HL\nRoom B204\nDr Novak", "Economics SL"],
      ],
      subjects,
    );

    expect(result.entries).toMatchObject([
      {
        weekday: 1,
        subject: "Chemistry",
        subject_id: "chemistry-id",
        room: "B204",
        teacher: "Dr Novak",
      },
      {
        weekday: 2,
        subject: "Economics",
        subject_id: "economics-id",
      },
    ]);
  });

  it("reads inline string cells from xlsx files", async () => {
    const zip = new JSZip();
    zip.file(
      "xl/workbook.xml",
      '<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Schedule" sheetId="1" r:id="rId1"/></sheets></workbook>',
    );
    zip.file(
      "xl/_rels/workbook.xml.rels",
      '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    );
    zip.file(
      "xl/worksheets/sheet1.xml",
      `<worksheet><sheetData>
        <row r="1">${cell("A1", "Day")}${cell("B1", "Subject")}${cell("C1", "Time")}</row>
        <row r="2">${cell("A2", "Wednesday")}${cell("B2", "Chemistry HL")}${cell("C2", "11:00-11:50")}</row>
      </sheetData></worksheet>`,
    );

    const bytes = await zip.generateAsync({ type: "uint8array" });
    const result = await parseScheduleImportFile(
      Buffer.from(bytes),
      "schedule.xlsx",
      subjects,
    );

    expect(result.entries).toMatchObject([
      {
        weekday: 3,
        subject: "Chemistry",
        subject_id: "chemistry-id",
        start_time: "11:00",
        end_time: "11:50",
      },
    ]);
  });

  it("reads schedule rows across workbook sheets", async () => {
    const zip = new JSZip();
    zip.file(
      "xl/workbook.xml",
      '<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Notes" sheetId="1" r:id="rId1"/><sheet name="Week A" sheetId="2" r:id="rId2"/></sheets></workbook>',
    );
    zip.file(
      "xl/_rels/workbook.xml.rels",
      '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/></Relationships>',
    );
    zip.file(
      "xl/worksheets/sheet1.xml",
      `<worksheet><sheetData><row r="1">${cell("A1", "Generated timetable")}</row></sheetData></worksheet>`,
    );
    zip.file(
      "xl/worksheets/sheet2.xml",
      `<worksheet><sheetData>
        <row r="1">${cell("A1", "Time")}${cell("B1", "Thursday")}</row>
        <row r="2">${cell("A2", "13:00-13:45")}${cell("B2", "Economics SL")}</row>
      </sheetData></worksheet>`,
    );

    const bytes = await zip.generateAsync({ type: "uint8array" });
    const workbook = await readScheduleImportWorkbook(
      Buffer.from(bytes),
      "schedule.xlsx",
    );
    const result = await parseScheduleImportFile(
      Buffer.from(bytes),
      "schedule.xlsx",
      subjects,
    );

    expect(workbook.sheets.map((sheet) => sheet.name)).toEqual([
      "Notes",
      "Week A",
    ]);
    expect(result.entries).toMatchObject([
      {
        weekday: 4,
        subject: "Economics",
        start_time: "13:00",
        end_time: "13:45",
      },
    ]);
  });

  it("expands merged xlsx class cells into consecutive lessons", async () => {
    const zip = new JSZip();
    zip.file(
      "xl/workbook.xml",
      '<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Schedule" sheetId="1" r:id="rId1"/></sheets></workbook>',
    );
    zip.file(
      "xl/_rels/workbook.xml.rels",
      '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    );
    zip.file(
      "xl/worksheets/sheet1.xml",
      `<worksheet><sheetData>
        <row r="1">${cell("A1", "Time")}${cell("B1", "Monday")}${cell("C1", "Wednesday")}</row>
        <row r="2">${cell("A2", "08:00-08:50")}${cell("B2", "Biology HL")}${cell("C2", "Biology HL")}</row>
        <row r="3">${cell("A3", "08:50-09:40")}</row>
      </sheetData><mergeCells count="2"><mergeCell ref="B2:B3"/><mergeCell ref="C2:C3"/></mergeCells></worksheet>`,
    );

    const bytes = await zip.generateAsync({ type: "uint8array" });
    const result = await parseScheduleImportFile(
      Buffer.from(bytes),
      "schedule.xlsx",
      subjects,
    );

    expect(result.entries).toMatchObject([
      {
        weekday: 1,
        subject: "Biology",
        subject_id: "biology-id",
        start_time: "08:00",
        end_time: "08:50",
      },
      {
        weekday: 3,
        subject: "Biology",
        subject_id: "biology-id",
        start_time: "08:00",
        end_time: "08:50",
      },
      {
        weekday: 1,
        subject: "Biology",
        subject_id: "biology-id",
        start_time: "08:50",
        end_time: "09:40",
      },
      {
        weekday: 3,
        subject: "Biology",
        subject_id: "biology-id",
        start_time: "08:50",
        end_time: "09:40",
      },
    ]);
  });

  it("validates and canonicalizes AI-normalized schedule rows", () => {
    const result = sanitizeAiScheduleImport(
      {
        entries: [
          {
            weekday: 1,
            subject: "Chem",
            subject_id: "chemistry-id",
            start_time: "9",
            end_time: "",
            duration_minutes: 50,
            room: " B204 ",
            teacher: " Dr Novak ",
            source_row: 4,
            confidence: 0.91,
          },
          {
            weekday: 1,
            subject: "Chemistry HL",
            subject_id: null,
            start_time: "09:00",
            end_time: "09:50",
            duration_minutes: null,
            room: "B204",
            teacher: "Dr Novak",
            source_row: 5,
            confidence: 0.8,
          },
          {
            weekday: 2,
            subject: "Lunch",
            subject_id: null,
            start_time: "12:00",
            end_time: "12:30",
            duration_minutes: 30,
            room: null,
            teacher: null,
            source_row: 6,
            confidence: 0.99,
          },
        ],
        issues: [],
      },
      subjects,
    );

    expect(result.entries).toEqual([
      {
        weekday: 1,
        subject: "Chemistry",
        subject_id: "chemistry-id",
        start_time: "09:00",
        end_time: "09:50",
        room: "B204",
        teacher: "Dr Novak",
      },
    ]);
    expect(result.issues).toContainEqual({
      row: 6,
      message: "Skipped a non-class or empty schedule item.",
    });
  });

  it("normalizes AI subject levels and places EE after Thursday math", () => {
    const result = sanitizeAiScheduleImport(
      {
        entries: [
          {
            weekday: 4,
            subject: "Math HL",
            subject_id: "math-id",
            start_time: "11:00",
            end_time: "11:50",
            duration_minutes: null,
            room: null,
            teacher: null,
            source_row: 2,
            confidence: 0.95,
          },
          {
            weekday: 1,
            subject: "EE",
            subject_id: null,
            start_time: "09:00",
            end_time: "09:45",
            duration_minutes: null,
            room: null,
            teacher: null,
            source_row: 3,
            confidence: 0.9,
          },
        ],
        issues: [],
      },
      subjects,
    );

    expect(result.entries).toEqual([
      {
        weekday: 4,
        subject: "Math",
        subject_id: "math-id",
        start_time: "11:00",
        end_time: "11:50",
        room: null,
        teacher: null,
      },
      {
        weekday: 4,
        subject: "Extended Essay",
        subject_id: null,
        start_time: "11:50",
        end_time: "12:35",
        room: null,
        teacher: null,
      },
    ]);
  });

  it("splits AI-collapsed double Biology lessons", () => {
    const result = sanitizeAiScheduleImport(
      {
        entries: [
          {
            weekday: 2,
            subject: "Chemistry",
            subject_id: "chemistry-id",
            start_time: "08:00",
            end_time: "08:50",
            duration_minutes: null,
            room: null,
            teacher: null,
            source_row: 2,
            confidence: 0.95,
          },
          {
            weekday: 1,
            subject: "Biology HL",
            subject_id: "biology-id",
            start_time: "09:00",
            end_time: "10:40",
            duration_minutes: null,
            room: null,
            teacher: null,
            source_row: 3,
            confidence: 0.9,
          },
          {
            weekday: 3,
            subject: "Biology HL",
            subject_id: "biology-id",
            start_time: "09:00",
            end_time: "10:40",
            duration_minutes: null,
            room: null,
            teacher: null,
            source_row: 4,
            confidence: 0.9,
          },
        ],
        issues: [],
      },
      subjects,
    );

    expect(result.entries).toMatchObject([
      {
        weekday: 2,
        subject: "Chemistry",
        start_time: "08:00",
        end_time: "08:50",
      },
      {
        weekday: 1,
        subject: "Biology",
        start_time: "09:00",
        end_time: "09:50",
      },
      {
        weekday: 1,
        subject: "Biology",
        start_time: "09:50",
        end_time: "10:40",
      },
      {
        weekday: 3,
        subject: "Biology",
        start_time: "09:00",
        end_time: "09:50",
      },
      {
        weekday: 3,
        subject: "Biology",
        start_time: "09:50",
        end_time: "10:40",
      },
    ]);
  });

  it("normalizes Language A Literature to English", () => {
    const result = parseScheduleRows(
      [
        ["Time", "Monday"],
        ["10:00-10:50", "Language A: Literature HL"],
      ],
      subjects,
    );

    expect(result.entries).toMatchObject([
      {
        weekday: 1,
        subject: "English",
        subject_id: "english-id",
      },
    ]);
  });
});

function cell(ref: string, value: string) {
  return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
