import { NextResponse } from "next/server";
import { createClient } from "@/lib/local/client";
import {
  regenerateRoadmap,
  toRoadmapRouteError,
} from "@/lib/roadmap-actions";

export async function POST(request: Request) {
  const local = await createClient();
  const {
    data: { user },
  } = await local.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const useAi = body.ai !== false;

  try {
    const data = await regenerateRoadmap(user.id, { use_ai: useAi }, local);
    return NextResponse.json(data);
  } catch (cause) {
    const error = toRoadmapRouteError(cause);
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
}
