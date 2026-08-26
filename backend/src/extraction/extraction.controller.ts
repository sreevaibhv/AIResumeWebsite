import { Controller, Post, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ExtractionService } from "./extraction.service";
import { OptionalJwtGuard, userIdOf, AuthedUser } from "../auth/optional-jwt.guard";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

/**
 * Optional auth, matching POST /scan: the first-scan flow (and the
 * documents that feed it) must work for a visitor who has never signed
 * in. Rate limiting is keyed on the user id when present, IP otherwise —
 * RedisService.checkRateLimit already implements fixed-window, fail-open
 * limiting and had no caller before this.
 */
@Controller("extract")
@UseGuards(OptionalJwtGuard)
export class ExtractionController {
  constructor(private readonly extractionService: ExtractionService) {}

  @Post()
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_FILE_BYTES } }))
  async extract(@UploadedFile() file: Express.Multer.File | undefined, @Req() req: { user?: AuthedUser; ip: string }) {
    return this.extractionService.extract(file, userIdOf(req) ?? req.ip);
  }
}
