import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { z } from "zod";

const QuerySchema = z.object({
  q: z.string().min(1).max(500),
});

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION ?? "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
  },
});

async function generateEmbedding(text: string): Promise<number[]> {
  const command = new InvokeModelCommand({
    modelId: "amazon.titan-embed-text-v2:0",
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({ inputText: text, dimensions: 1024, normalize: true }),
  });

  const response = await bedrockClient.send(command);
  const body = JSON.parse(new TextDecoder().decode(response.body)) as { embedding: number[] };
  return body.embedding;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = QuerySchema.safeParse({ q: searchParams.get("q") });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const queryEmbedding = await generateEmbedding(parsed.data.q);

    // Perform cosine similarity search via Supabase RPC
    const { data: results, error } = await supabase.rpc("search_embeddings", {
      query_embedding: queryEmbedding,
      match_user_id: user.id,
      match_threshold: 0.5,
      match_count: 10,
    });

    if (error) {
      console.error("Search error:", error);
      return NextResponse.json({ results: [] });
    }

    return NextResponse.json({ results: results ?? [] });
  } catch (err) {
    console.error("Bedrock error:", err);
    // Graceful fallback: return empty results if Bedrock is unavailable
    return NextResponse.json({ results: [] });
  }
}
