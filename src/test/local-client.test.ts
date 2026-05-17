import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "fs";
import {
  createClient,
  getLocalDataPaths,
  getLocalDb,
  writeLocalDb,
} from "@/lib/local/client";
import { POST as resetWorkspace } from "@/app/api/workspace-reset/route";

async function resetLocalData() {
  const { dataDir } = getLocalDataPaths();
  await fs.rm(dataDir, { recursive: true, force: true });
}

describe("local personal data client", () => {
  beforeEach(async () => {
    await resetLocalData();
  });

  afterEach(async () => {
    await resetLocalData();
  });

  it("recovers malformed db.json to a timestamped backup", async () => {
    const { dataDir, dbPath } = getLocalDataPaths();
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(dbPath, "{not-json");

    const db = await getLocalDb();
    const backups = await fs.readdir(dataDir);

    expect(db.profiles).toHaveLength(1);
    expect(backups.some((name) => name.startsWith("db.malformed-"))).toBe(true);
  });

  it("serializes concurrent local writes without dropping rows", async () => {
    const local = await createClient();
    await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        local.from("tasks").insert({
          user_id: "personal-user",
          title: `Queued task ${index}`,
        })
      )
    );

    const db = await getLocalDb();
    expect(db.tasks).toHaveLength(12);
  });

  it("rejects upload paths that escape the uploads directory", async () => {
    const local = await createClient();

    await expect(
      local.storage.from("resources").upload("../escape.txt", new Blob(["x"]))
    ).rejects.toThrow("Unsafe upload path");
  });

  it("wipes runtime tables on reset while preserving a reset profile", async () => {
    const db = await getLocalDb();
    db.profiles[0] = {
      ...db.profiles[0],
      onboarding_complete: true,
      exam_session: "May 2026",
    };
    db.resources.push({ id: "resource-1", user_id: "personal-user" });
    db.embeddings.push({ id: "embedding-1", user_id: "personal-user" });
    db.integrations.push({ id: "integration-1", user_id: "personal-user" });
    db.curriculum_documents.push({ id: "doc-1", user_id: "personal-user" });
    await writeLocalDb(db);

    const response = await resetWorkspace();
    const nextDb = await getLocalDb();

    expect(response.status).toBe(200);
    expect(nextDb.resources).toHaveLength(0);
    expect(nextDb.embeddings).toHaveLength(0);
    expect(nextDb.integrations).toHaveLength(0);
    expect(nextDb.curriculum_documents).toHaveLength(0);
    expect(nextDb.profiles).toHaveLength(1);
    expect(nextDb.profiles[0]?.onboarding_complete).toBe(false);
    expect(nextDb.profiles[0]?.exam_session).toBeNull();
  });
});
