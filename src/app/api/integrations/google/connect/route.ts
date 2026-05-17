import { NextRequest, NextResponse } from "next/server";
import { buildGoogleAuthUrl } from "@/lib/google-drive";
import { createClient } from "@/lib/local/client";

export async function GET(request: NextRequest) {
  const local = await createClient();
  const {
    data: { user },
  } = await local.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const returnTo = request.nextUrl.searchParams.get("returnTo") ?? "/settings";
    return NextResponse.redirect(buildGoogleAuthUrl(user.id, returnTo));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not start Google connection" },
      { status: 500 }
    );
  }
}
