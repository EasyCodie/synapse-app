import { NextResponse } from "next/server";
import { createClient } from "@/lib/local/client";
import {
  createRoadmapItem,
  toRoadmapRouteError,
  updateRoadmapItem,
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

  try {
    const item = await createRoadmapItem(user.id, body, local);
    return NextResponse.json({ item }, { status: 201 });
  } catch (cause) {
    const error = toRoadmapRouteError(cause);
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
}

export async function PATCH(request: Request) {
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

  try {
    const item = await updateRoadmapItem(user.id, body, local);
    return NextResponse.json({ item });
  } catch (cause) {
    const error = toRoadmapRouteError(cause);
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
}
