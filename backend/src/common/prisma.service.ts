import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 dropped the schema-level datasource `url` in favor of driver
// adapters passed to the PrismaClient constructor at runtime (the CLI's own
// connection, for migrate/generate, is configured separately in
// prisma.config.ts). This is that runtime wiring.
function buildAdapter(): PrismaPg {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set — PrismaService cannot construct its driver adapter.");
  }
  return new PrismaPg({ connectionString: process.env.DATABASE_URL });
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({ adapter: buildAdapter() });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
