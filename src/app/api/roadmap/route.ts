import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/local/client";
import { ensureCurriculumScaffold } from "@/lib/curriculum";
import { ensureRoadmapForUser, loadRoadmapData } from "@/lib/roadmap";

export async function GET(request: NextRequest) {
  const local = await createClient();
  const {
    data: { user },
  } = await local.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureCurriculumScaffold(user.id);
    await ensureRoadmapForUser(user.id, { localClient: local });

    const includeHidden = request.nextUrl.searchParams.get("hidden") === "true";
    const data = await loadRoadmapData(user.id, {
      includeHidden,
      localClient: local,
    });

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Failed to load roadmap" },
      { status: 500 }
    );
  }
}
