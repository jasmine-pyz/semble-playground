import { NextRequest, NextResponse } from "next/server";

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const DEFAULT_MODEL = process.env.OLLAMA_EMBED_MODEL ?? "nomic-embed-text";

// In-memory cache: cardId → embedding
// Survives across requests in the same server process (dev + prod)
const embeddingCache = new Map<string, number[]>();

interface EmbedRequest {
  cards: { id: string; text: string }[];
  model?: string;
}

export async function POST(req: NextRequest) {
  const { cards, model = DEFAULT_MODEL }: EmbedRequest = await req.json();

  const uncached = cards.filter((c) => !embeddingCache.has(c.id));

  // Batch uncached cards in chunks of 20 — avoids overwhelming Ollama
  const CHUNK = 20;
  for (let i = 0; i < uncached.length; i += CHUNK) {
    const chunk = uncached.slice(i, i + CHUNK);
    await Promise.all(
      chunk.map(async ({ id, text }) => {
        const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model, prompt: text }),
        });

        if (!res.ok) {
          throw new Error(
            `Ollama error for card ${id}: ${res.status} ${await res.text()}`
          );
        }

        const { embedding }: { embedding: number[] } = await res.json();
        embeddingCache.set(id, embedding);
      })
    );
  }

  // Return all embeddings (cached + freshly computed) in original order
  const embeddings = cards.map((c) => ({
    id: c.id,
    embedding: embeddingCache.get(c.id)!,
  }));

  return NextResponse.json({ embeddings });
}

// Expose cache stats for debugging
export async function GET() {
  return NextResponse.json({ cachedCards: embeddingCache.size });
}
