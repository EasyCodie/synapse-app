import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/flashcards — list all flashcards for the current user
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const subjectId = searchParams.get("subject_id");
  const dueOnly = searchParams.get("due") === "true";

  let query = supabase
    .from("flashcards")
    .select("id, subject_id, resource_id, front, back, tags, confidence, next_review, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(500);

  if (subjectId) {
    query = query.eq("subject_id", subjectId);
  }

  if (dueOnly) {
    query = query.lte("next_review", new Date().toISOString());
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ flashcards: data });
}

// PATCH /api/flashcards — update confidence + next_review for a card
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, confidence } = body;

  if (!id || confidence === undefined) {
    return NextResponse.json(
      { error: "id and confidence are required" },
      { status: 400 }
    );
  }

  // Simple spaced repetition: higher confidence = longer interval
  const intervals = [0, 1, 2, 4, 7, 14]; // days until next review by confidence level
  const daysUntilReview = intervals[Math.min(confidence, 5)] ?? 14;
  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + daysUntilReview);

  const { data, error } = await supabase
    .from("flashcards")
    .update({
      confidence: Math.min(Math.max(confidence, 0), 5),
      next_review: nextReview.toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, subject_id, resource_id, front, back, tags, confidence, next_review, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ flashcard: data });
}

// DELETE /api/flashcards — delete a flashcard
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("flashcards")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
