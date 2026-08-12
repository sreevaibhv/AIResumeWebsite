/**
 * §8.4 — pgvector primary, Qdrant swappable behind this interface.
 * What gets embedded: individual skills and responsibility phrases, not
 * whole resumes/JDs — whole-document embeddings are too coarse to answer
 * "does *this* skill match *that* requirement," which is the only question
 * SemanticMatchAgent needs answered.
 */

export interface CandidatePair {
  resumeTerm: string;
  jdTerm: string;
  similarity: number; // cosine similarity, 0-1
}

export interface VectorStore {
  /** Embeds and caches a term by its normalized text (skills/phrases repeat heavily across users). */
  ensureEmbedded(terms: string[]): Promise<void>;

  /**
   * For each JD term, finds resume terms above `threshold` cosine similarity.
   * Returns candidates, not conclusions — SemanticMatchAgent adjudicates them.
   */
  matchCandidates(resumeTerms: string[], jdTerms: string[], threshold?: number): Promise<CandidatePair[]>;
}
