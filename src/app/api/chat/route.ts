import { createClient } from "@/lib/supabase/server";
import {
  BedrockRuntimeClient,
  ConverseStreamCommand,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION ?? "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
  },
});

const CHAT_MODEL_ID = process.env.BEDROCK_CHAT_MODEL_ID ?? "minimax.minimax-01";

async function generateEmbedding(text: string): Promise<number[]> {
  const command = new InvokeModelCommand({
    modelId: "amazon.titan-embed-text-v2:0",
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({ inputText: text, dimensions: 1024, normalize: true }),
  });

  const response = await bedrockClient.send(command);
  const body = JSON.parse(new TextDecoder().decode(response.body)) as {
    embedding: number[];
  };
  return body.embedding;
}

interface Source {
  id: string;
  source_type: string;
  source_id: string;
  content_text: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

const SYSTEM_PROMPT = `You are Synapse AI, an intelligent study assistant for IB Diploma Programme students. You help students understand their notes, resources, and course material.

IMPORTANT RULES:
- Only answer based on the provided context from the student's own resources.
- If the context doesn't contain enough information to answer, say so honestly.
- Always cite your sources using [Source N] notation where N corresponds to the numbered sources provided.
- Be concise, clear, and educational in your responses.
- Use markdown formatting for structure (headings, bullet points, bold) when helpful.
- If a student asks about something not in their resources, suggest they upload relevant materials.`;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  const { message, history } = (await request.json()) as {
    message: string;
    history?: Array<{ role: string; content: string }>;
  };

  if (!message || typeof message !== "string") {
    return new Response(JSON.stringify({ error: "Message required" }), {
      status: 400,
    });
  }

  try {
    // 1. Generate embedding for the query
    const queryEmbedding = await generateEmbedding(message);

    // 2. Search for relevant sources
    const { data: sources } = await supabase.rpc("search_embeddings", {
      query_embedding: queryEmbedding,
      match_user_id: user.id,
      match_threshold: 0.4,
      match_count: 6,
    });

    const relevantSources: Source[] = (sources as Source[]) ?? [];

    // 3. Build context from sources
    let contextBlock = "";
    if (relevantSources.length > 0) {
      contextBlock = relevantSources
        .map((s, i) => {
          const title =
            (s.metadata as Record<string, unknown>)?.title ?? s.source_type;
          return `[Source ${i + 1}] (${title}, similarity: ${(s.similarity * 100).toFixed(0)}%)\n${s.content_text}`;
        })
        .join("\n\n---\n\n");
    }

    // 4. Build messages for Converse API
    const converseMessages: Array<{
      role: "user" | "assistant";
      content: Array<{ text: string }>;
    }> = [];

    // Include conversation history (last 10 messages)
    if (history && Array.isArray(history)) {
      const recentHistory = history.slice(-10);
      for (const msg of recentHistory) {
        converseMessages.push({
          role: msg.role as "user" | "assistant",
          content: [{ text: msg.content }],
        });
      }
    }

    // Build user message with context
    const userMessage = contextBlock
      ? `Here are relevant excerpts from my study resources:\n\n${contextBlock}\n\n---\n\nMy question: ${message}`
      : `I don't have any uploaded resources yet that match this query. My question: ${message}`;

    converseMessages.push({ role: "user", content: [{ text: userMessage }] });

    // 5. Stream response via Converse API (works with all Bedrock models)
    const command = new ConverseStreamCommand({
      modelId: CHAT_MODEL_ID,
      system: [{ text: SYSTEM_PROMPT }],
      messages: converseMessages,
      inferenceConfig: {
        maxTokens: 2048,
        temperature: 0.3,
      },
    });

    const response = await bedrockClient.send(command);

    // 6. Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // First, send sources metadata
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "sources", sources: relevantSources.map((s, i) => ({ index: i + 1, title: (s.metadata as Record<string, unknown>)?.title ?? s.source_type, source_type: s.source_type, source_id: s.source_id, similarity: s.similarity })) })}\n\n`
          )
        );

        // Stream text chunks from Converse API
        if (response.stream) {
          for await (const event of response.stream) {
            if (event.contentBlockDelta?.delta?.text) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "text", text: event.contentBlockDelta.delta.text })}\n\n`
                )
              );
            }
          }
        }

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
        );
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("Chat error:", err);
    return new Response(
      JSON.stringify({
        error: "AI service unavailable. Please check AWS credentials and model access.",
      }),
      { status: 500 }
    );
  }
}
