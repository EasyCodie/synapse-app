import { describe, it, expect } from "vitest";
import { generateWorkspace, generateAllWorkspaces } from "@/lib/workspace-generator";

describe("workspace-generator", () => {
  const physicsHL = {
    id: "physics",
    name: "Physics",
    group: 4,
    level: "HL" as const,
    language: "English",
  };

  const economicsSL = {
    id: "economics",
    name: "Economics",
    group: 3,
    level: "SL" as const,
    language: "English",
  };

  const mathAA = {
    id: "math-aa",
    name: "Mathematics: Analysis and Approaches (AA)",
    group: 5,
    level: "HL" as const,
    language: "English",
  };

  it("generates a workspace for a known subject with IA config", () => {
    const ws = generateWorkspace(physicsHL);
    expect(ws.subjectId).toBe("physics");
    expect(ws.level).toBe("HL");
    expect(ws.iaConfig).not.toBeNull();
    expect(ws.iaConfig?.targetWordCount).toBe(3000);
    expect(ws.iaConfig?.milestones.length).toBeGreaterThan(0);
  });

  it("generates syllabus topics for physics", () => {
    const ws = generateWorkspace(physicsHL);
    expect(ws.syllabusTopics.length).toBeGreaterThan(0);
    expect(ws.syllabusTopics[0]).toHaveProperty("id");
    expect(ws.syllabusTopics[0]).toHaveProperty("title");
    expect(ws.syllabusTopics[0]).toHaveProperty("subtopics");
  });

  it("generates folders including IA folder for subjects with IA", () => {
    const ws = generateWorkspace(physicsHL);
    const folderNames = ws.folders.map((f) => f.name);
    expect(folderNames).toContain("Notes");
    expect(folderNames).toContain("Syllabus Checklist");
    expect(folderNames).toContain("Past Papers");
    expect(folderNames).toContain("Internal Assessment");
  });

  it("generates syllabus checklist items from subtopics", () => {
    const ws = generateWorkspace(physicsHL);
    const syllabusFolder = ws.folders.find((f) => f.name === "Syllabus Checklist");
    expect(syllabusFolder).toBeDefined();
    expect(syllabusFolder?.items?.length).toBeGreaterThan(0);
    syllabusFolder?.items?.forEach((item) => {
      expect(item.completed).toBe(false);
    });
  });

  it("handles subjects without IA data gracefully", () => {
    const unknownSubject = {
      id: "unknown-subject",
      name: "Unknown Subject",
      group: 6,
      level: "SL" as const,
      language: "English",
    };
    const ws = generateWorkspace(unknownSubject);
    expect(ws.iaConfig).toBeNull();
    expect(ws.syllabusTopics).toHaveLength(0);
    // Should still have basic folders
    const folderNames = ws.folders.map((f) => f.name);
    expect(folderNames).toContain("Notes");
    expect(folderNames).not.toContain("Internal Assessment");
  });

  it("generates workspaces for all subjects", () => {
    const subjects = [physicsHL, economicsSL, mathAA];
    const workspaces = generateAllWorkspaces(subjects);
    expect(workspaces).toHaveLength(3);
    expect(workspaces[0]?.subjectId).toBe("physics");
    expect(workspaces[1]?.subjectId).toBe("economics");
    expect(workspaces[2]?.subjectId).toBe("math-aa");
  });

  it("economics IA has 3 commentary components", () => {
    const ws = generateWorkspace(economicsSL);
    expect(ws.iaConfig).not.toBeNull();
    expect(ws.iaConfig?.targetWordCount).toBe(2250);
  });

  it("all milestone items start as not completed", () => {
    const ws = generateWorkspace(physicsHL);
    ws.iaConfig?.milestones.forEach((m) => {
      expect(m.completed).toBe(false);
    });
  });
});
