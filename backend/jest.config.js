/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: "src",
  testMatch: ["**/*.test.ts"],
  // *.golden.test.ts calls the live LLM provider and needs GEMINI_API_KEY
  // from .env, same as running the app itself.
  setupFiles: ["dotenv/config"],
  // Golden/eval tests hit the live LLM provider and can run slower than a
  // unit test — give them room rather than a false-negative timeout. A
  // single call can legitimately take 35s+ once callProviderWithRetry
  // fires (llm-provider.ts), so this needs real headroom, not just margin
  // over average latency.
  testTimeout: 60000,
};
