import { NextResponse } from "next/server";
import { createClient } from "@/lib/local/client";
import {
  linkRoadmapItem,
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

  try {
    const result = await linkRoadmapItem(
      user.id,
      {
        id: typeof body.id === "string" ? body.id : undefined,
        kind:
          typeof body.kind === "string"
            ? body.kind
            : typeof body.type === "string"
              ? body.type
              : typeof body.link_type === "string"
                ? body.link_type
                : undefined,
      },
      local
    );
    return NextResponse.json(result);
  } catch (cause) {
    const error = toRoadmapRouteError(cause);
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
}
