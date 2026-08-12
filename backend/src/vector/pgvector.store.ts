import { PrismaClient } from "@prisma/client";
import { VectorStore, CandidatePair } from "./vector-store.interface";
import { embedTerms, normalizeTerm } from "./embed";

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

/**
 * pgvector-backed VectorStore. §8.4: cache by normalized term text, since
 * skills and responsibility phrases repeat heavily across users — this is
 * the "embedding cache" cost lever from §8.3/§7.3.
 */
export class PgVectorStore implements VectorStore {
  constructor(private readonly prisma: PrismaClient) {}

  async ensureEmbedded(terms: string[]): Promise<void> {
    const normalized = Array.from(new Set(terms.map(normalizeTerm))).filter(Boolean);
    if (normalized.length === 0) return;

    const existing = await this.prisma.skillEmbedding.findMany({
      where: { normalizedTerm: { in: normalized } },
      select: { normalizedTerm: true },
    });
    const existingSet = new Set(existing.map((e) => e.normalizedTerm));
    const missing = normalized.filter((t) => !existingSet.has(t));
    if (missing.length === 0) return;

    const embeddings = await embedTerms(missing);
    for (let i = 0; i < missing.length; i++) {
      const vectorLiteral = toVectorLiteral(embeddings[i]);
      // Raw insert — Prisma's typed client can't yet write `vector` columns directly.
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO "SkillEmbedding" (id, "normalizedTerm", embedding, "createdAt")
         VALUES (gen_random_uuid()::text, $1, $2::vector, now())
         ON CONFLICT ("normalizedTerm") DO NOTHING`,
        missing[i],
        vectorLiteral,
      );
    }
  }

  async matchCandidates(resumeTerms: string[], jdTerms: string[], threshold = 0.6): Promise<CandidatePair[]> {
    const normResume = Array.from(new Set(resumeTerms.map(normalizeTerm)));
    const normJd = Array.from(new Set(jdTerms.map(normalizeTerm)));
    if (normResume.length === 0 || normJd.length === 0) return [];

    await this.ensureEmbedded([...normResume, ...normJd]);

    const candidates: CandidatePair[] = [];
    for (const jdTerm of normJd) {
      // 1 - cosine_distance = cosine_similarity. pgvector's <=> operator is cosine distance.
      const rows = await this.prisma.$queryRawUnsafe<Array<{ normalizedTerm: string; similarity: number }>>(
        `SELECT r."normalizedTerm", 1 - (r.embedding <=> j.embedding) AS similarity
         FROM "SkillEmbedding" r, "SkillEmbedding" j
         WHERE j."normalizedTerm" = $1
           AND r."normalizedTerm" = ANY($2::text[])
         ORDER BY similarity DESC`,
        jdTerm,
        normResume,
      );
      for (const row of rows) {
        if (row.similarity >= threshold) {
          candidates.push({ resumeTerm: row.normalizedTerm, jdTerm, similarity: row.similarity });
        }
      }
    }
    return candidates;
  }
}
