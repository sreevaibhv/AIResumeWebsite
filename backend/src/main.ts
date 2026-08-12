import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";
import { PrismaService } from "./common/prisma.service";
import { wireUsageLogging } from "./common/usage-logger";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // FR-18 — wire per-call LLM cost/token logging to Postgres before any
  // agent can run.
  wireUsageLogging(app.get(PrismaService));

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`PARSE// backend listening on :${port}`);
}

bootstrap();
