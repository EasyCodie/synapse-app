import { createClient } from "@/lib/local/client";
import {
  inferResourceMimeType,
  isAllowedMimeType,
  RESOURCE_BUCKET,
  RESOURCE_LIBRARY_ALLOWED_MIME_TYPES,
  sanitizeResourceFilename,
} from "@/lib/resource-upload";
import { NextResponse } from "next/server";

type ResourceFileRecord = {
  id: string;
  title: string;
  type?: string | null;
  file_path?: string | null;
  mime_type?: string | null;
};

function contentDisposition(title: string, mimeType: string, forceDownload: boolean) {
  const inlineSafe = mimeType === "application/pdf" || mimeType.startsWith("text/");
  const disposition = forceDownload || !inlineSafe ? "attachment" : "inline";
  const filename = sanitizeResourceFilename(title || "resource") || "resource";

  return `${disposition}; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const local = await createClient();
  const {
    data: { user },
  } = await local.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: resource } = await local
    .from("resources")
    .select("id, title, type, file_path, mime_type")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!resource) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const typedResource = resource as ResourceFileRecord;
  if (!typedResource.file_path || !typedResource.file_path.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: "Original file not available" }, { status: 404 });
  }

  const mimeType = inferResourceMimeType(typedResource);
  if (!isAllowedMimeType(mimeType, RESOURCE_LIBRARY_ALLOWED_MIME_TYPES)) {
    return NextResponse.json({ error: "File preview is not available" }, { status: 415 });
  }

  const { data: fileData, error } = await local.storage
    .from(RESOURCE_BUCKET)
    .download(typedResource.file_path);

  if (error || !fileData) {
    return NextResponse.json({ error: "Original file not available" }, { status: 404 });
  }

  const forceDownload = new URL(request.url).searchParams.get("download") === "1";
  const body = await fileData.arrayBuffer();

  return new Response(body, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": contentDisposition(
        typedResource.title,
        mimeType,
        forceDownload,
      ),
      "Content-Type": mimeType,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
