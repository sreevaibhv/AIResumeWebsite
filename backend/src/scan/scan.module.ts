import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { ScanController } from "./scan.controller";
import { ScanService } from "./scan.service";
import { PrismaService } from "../common/prisma.service";
import { RedisService } from "../common/redis.service";

@Module({
  // PassportModule so the scan guards can resolve the "jwt" strategy
  // that AuthModule registers (BE-1).
  imports: [PassportModule],
  controllers: [ScanController],
  providers: [ScanService, PrismaService, RedisService],
})
export class ScanModule {}
