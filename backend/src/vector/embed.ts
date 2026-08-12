import { GoogleGenAI } from "@google/genai";

let client: GoogleGenAI | null = null;

// gemini-embedding-2 supports configurable output dimensionality via
// Matryoshka truncation (128-3072, auto-normalized) — requesting 1536 keeps
// SkillEmbedding.embedding's fixed vector(1536) column unchanged regardless
// of which provider generated the vectors.
const EMBEDDING_MODEL = "gemini-embedding-2";
const OUTPUT_DIMENSIONALITY = 1536;

function getClient(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error(`GEMINI_API_KEY is not set — cannot generate embeddings (${EMBEDDING_MODEL}, ${OUTPUT_DIMENSIONALITY} dims, matches SkillEmbedding.embedding).`);
  }
  if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

export function normalizeTerm(term: string): string {
  return term.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Batch-embeds terms. Returns embeddings in the same order as input. */
export async function embedTerms(terms: string[]): Promise<number[][]> {
  if (terms.length === 0) return [];
  const ai = getClient();
  // Each term must be its own Content object ({ parts: [{ text }] }) — a
  // flat string[] gets treated as multiple parts of ONE content and comes
  // back as a single averaged embedding, not one per term. Confirmed against
  // the live API: contents: ["a","b","c"] returned embeddings.length === 1.
  const response = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: terms.map((term) => ({ parts: [{ text: term }] })),
    config: { outputDimensionality: OUTPUT_DIMENSIONALITY },
  });
  const embeddings = response.embeddings ?? [];
  if (embeddings.length !== terms.length) {
    throw new Error(`embedTerms: requested ${terms.length} embeddings, Gemini returned ${embeddings.length}.`);
  }
  return embeddings.map((e) => e.values ?? []);
}
