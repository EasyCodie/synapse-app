import { NextResponse } from "next/server";
import { getGoogleDriveStatus } from "@/lib/google-drive";
import { createClient } from "@/lib/local/client";

export async function GET() {
  const local = await createClient();
  const {
    data: { user },
  } = await local.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json(await getGoogleDriveStatus(user.id));
}
