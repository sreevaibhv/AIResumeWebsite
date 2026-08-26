import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { ResumesController } from "./resumes.controller";
import { ResumesService } from "./resumes.service";
import { PrismaService } from "../common/prisma.service";

@Module({
  imports: [PassportModule],
  controllers: [ResumesController],
  providers: [ResumesService, PrismaService],
})
export class ResumesModule {}
