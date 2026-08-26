import { IsInt, IsObject, IsOptional, IsString, Min } from "class-validator";

/** spec §6.1/§6.2 — a flat, standalone save. No parent entity, no lineage. */
export class SaveResumeDto {
  @IsObject()
  structuredResume: Record<string, unknown>;

  @IsString()
  @IsOptional()
  label?: string;

  @IsString()
  @IsOptional()
  role?: string;

  @IsString()
  @IsOptional()
  company?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  score?: number;

  @IsString()
  @IsOptional()
  sourceScanId?: string;
}
