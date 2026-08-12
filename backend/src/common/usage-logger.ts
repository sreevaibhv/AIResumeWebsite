import { setUsageSink } from "../llm/llm-provider";
import { PrismaService } from "./prisma.service";

/**
 * FR-18 — wires the LLM abstraction's usage sink (default: console log) to
 * real UsageLog persistence. Called once at bootstrap (main.ts) so agents
 * stay framework-agnostic per the §8.1 pattern — they only know about
 * completeStructured(), never about Prisma or Nest DI.
 */
export function wireUsageLogging(prisma: PrismaService): void {
  setUsageSink((entry) => {
    prisma.usageLog
      .create({
        data: {
          scanId: entry.scanId,
          agentName: entry.agentName,
          provider: entry.provider,
          model: entry.model,
          tokensIn: entry.tokensIn,
          tokensOut: entry.tokensOut,
          costUsd: entry.costUsd,
          latencyMs: entry.latencyMs,
        },
      })
      .catch((err) => {
        // Usage logging must never take down a scan — log and move on.
        // eslint-disable-next-line no-console
        console.warn(`[usage-logger] failed to persist usage row: ${err.message}`);
      });
  });
}
