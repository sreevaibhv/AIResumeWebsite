import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { ExtractionController } from "./extraction.controller";
import { ExtractionService } from "./extraction.service";
import { RedisService } from "../common/redis.service";

@Module({
  // PassportModule so OptionalJwtGuard can resolve the "jwt" strategy
  // AuthModule registers (same pattern as ScanModule).
  imports: [PassportModule],
  controllers: [ExtractionController],
  providers: [ExtractionService, RedisService],
})
export class ExtractionModule {}
