import OpenAI from "openai";

const EMBEDDING_MODEL =
  process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";

/**
 * Generates a 1024-dim embedding using OpenAI text-embedding-3-small.
 * Lazily initializes the client so build-time doesn't fail without the key.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
    dimensions: 1024,
  });

  return response.data[0]!.embedding;
}
