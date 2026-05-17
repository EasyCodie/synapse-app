import { NextResponse } from "next/server";
import { disconnectGoogleDrive } from "@/lib/google-drive";
import { createClient } from "@/lib/local/client";

export async function POST() {
  const local = await createClient();
  const {
    data: { user },
  } = await local.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await disconnectGoogleDrive(user.id);
  return NextResponse.json({ ok: true });
}
