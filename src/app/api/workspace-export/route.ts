import { promises as fs } from "fs";
import path from "path";
import JSZip from "jszip";
import { createClient, getLocalDataPaths, getLocalDb } from "@/lib/local/client";

async function addUploadFiles(zip: JSZip, uploadDir: string, currentDir = uploadDir) {
  let entries: Array<{ name: string; isDirectory(): boolean; isFile(): boolean }>;
  try {
    entries = await fs.readdir(currentDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name);
    const relativePath = path
      .relative(uploadDir, absolutePath)
      .split(path.sep)
      .join("/");

    if (entry.isDirectory()) {
      await addUploadFiles(zip, uploadDir, absolutePath);
      continue;
    }

    if (entry.isFile()) {
      zip.file(`uploads/${relativePath}`, await fs.readFile(absolutePath));
    }
  }
}

export async function GET() {
  const local = await createClient();
  const {
    data: { user },
  } = await local.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { uploadDir } = getLocalDataPaths();
  const db = await getLocalDb();
  const generatedAt = new Date().toISOString();
  const zip = new JSZip();

  zip.file("db.json", JSON.stringify(db, null, 2));
  zip.file(
    "manifest.json",
    JSON.stringify(
      {
        app: "Synapse",
        mode: "personal-local",
        generated_at: generatedAt,
        user_id: user.id,
        tables: Object.fromEntries(
          Object.entries(db).map(([table, rows]) => [
            table,
            Array.isArray(rows) ? rows.length : 0,
          ])
        ),
      },
      null,
      2
    )
  );

  await addUploadFiles(zip, uploadDir);

  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });
  const filename = `synapse-export-${generatedAt.slice(0, 10)}.zip`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
