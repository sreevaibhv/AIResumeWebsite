import { BadRequestException, HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { completeMultimodalText } from "../llm/llm-provider";
import { RedisService } from "../common/redis.service";

const ALLOWED_MIME_TYPES = new Set(["application/pdf"]);
const RATE_LIMIT = 10;
const RATE_WINDOW_SECONDS = 60 * 60;

/**
 * Tier 2 (spec: two-tier PDF extraction). The browser already ran pdfjs
 * and its own assessExtraction() quality check failed — this is a plain
 * transcription of the document via Gemini's native PDF read, not a parse:
 * ParseResumeAgent still owns all structuring, so there remains exactly
 * one parsing path regardless of which tier produced the text.
 *
 * Strict-transcription framing in the prompt, plus the caller always
 * routing this through an editable confirm step before it reaches
 * createScan, are the mitigations against a vision model inventing
 * plausible-looking content on a hard-to-read scan (invariant #1 exposure
 * moved upstream of RewriteAgent/VerifyAgent).
 */
const EXTRACTION_PROMPT = `Transcribe the visible text of this resume document exactly as it appears.

Rules:
- Transcribe ONLY text that is actually visible in the document. Never summarize, reformat, paraphrase, infer, or add anything not present.
- Preserve the original section order and line breaks as closely as possible.
- If a section, field or detail is not present in the document, do not invent it or fill it in.
- Return plain text only — no markdown formatting, no commentary, no code fences.`;

@Injectable()
export class ExtractionService {
  constructor(private readonly redis: RedisService) {}

  async extract(file: Express.Multer.File | undefined, rateLimitKey: string): Promise<{ text: string }> {
    if (!file) {
      throw new BadRequestException("No file was uploaded.");
    }
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException("Only PDF files can be processed here.");
    }

    const { allowed } = await this.redis.checkRateLimit(`extract:${rateLimitKey}`, RATE_LIMIT, RATE_WINDOW_SECONDS);
    if (!allowed) {
      throw new HttpException(
        "Too many document reads. Please try again later, or paste your resume text directly.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const result = await completeMultimodalText(file.buffer, file.mimetype, EXTRACTION_PROMPT, "DocumentExtractionAgent");
    return { text: result.data };
  }
}
