import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Prisma 7 — connection URL for CLI operations (generate, migrate, studio)
// lives here, not in schema.prisma. The PrismaClient runtime connection is
// separate: it goes through the @prisma/adapter-pg driver adapter
// constructed in src/common/prisma.service.ts.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
