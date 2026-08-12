/**
 * PARSE// agent pattern — Master Plan §8.1. Every agent in this system is
 * these four things wired together, no exceptions. This file is reference
 * documentation, not an importable module; copy the shape, not this file.
 *
 * 1. Zod output schema — what the agent is allowed to return.
 * 2. Prompt builder — 2-3 few-shot examples, always. The examples are a
 *    static prefix on every call, which is also free prompt-caching (§7.3).
 * 3. The agent function — one completeStructured() call, logging its own
 *    cost via the usage sink wired in llm-provider.ts.
 * 4. A golden-set test — 5-10 known input/output pairs to catch regressions
 *    when a model gets swapped or downgraded (§8.2's "build on the good
 *    model first, downgrade with golden tests as evidence").
 *
 * No agent skips step 4. That's what turns "I called an LLM" into
 * "I built and validated an agent."
 *
 * ---------------------------------------------------------------------
 *
 * import { z } from "zod";
 * import { completeStructured } from "../llm/llm-provider";
 *
 * const OutputSchema = z.object({ ... });
 * type Output = z.infer<typeof OutputSchema>;
 *
 * function buildPrompt(input: AgentInput): string {
 *   return `${TASK_INSTRUCTION}\n\nExamples:\n${FEW_SHOT_EXAMPLES}\n\nReturn ONLY JSON matching the schema.\n\nNow process this:\n${JSON.stringify(input)}`;
 * }
 *
 * export async function runAgent(input: AgentInput, scanId?: string) {
 *   const prompt = buildPrompt(input);
 *   return completeStructured(prompt, OutputSchema, "AgentName", { scanId });
 * }
 *
 * export const goldenTests: Array<{ input: AgentInput; expect: Partial<Output> }> = [ ... ];
 */
export {};
