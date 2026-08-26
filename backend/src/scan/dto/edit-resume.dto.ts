import { IsArray, IsOptional, IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

/**
 * Shape validation for a user-edited structured resume — a cost/crash
 * guard, not resume-quality gatekeeping. This payload feeds straight into
 * ScanPipeline.runFromStructured (4+ LLM calls) and the pure scoring
 * functions, which .flatMap()/.find() across these arrays; a malformed
 * shape here throws mid-pipeline *after* paying for the LLM calls, or
 * silently produces NaN in the aggregator. No @IsNotEmpty()/@ArrayMinSize()
 * anywhere — a blank field or an empty experience[] (a genuine fresher) is
 * a normal, saveable resume.
 */
class EditedContactDto {
  @IsString()
  name: string;

  @IsString()
  email: string;

  @IsString()
  phone: string;

  @IsString()
  @IsOptional()
  linkedin?: string;

  @IsString()
  @IsOptional()
  github?: string;
}

class EditedExperienceItemDto {
  @IsString()
  title: string;

  @IsString()
  company: string;

  @IsString()
  start: string;

  @IsString()
  end: string;

  @IsArray()
  @IsString({ each: true })
  bullets: string[];
}

class EditedProjectItemDto {
  @IsString()
  name: string;

  @IsArray()
  @IsString({ each: true })
  bullets: string[];
}

class EditedEducationItemDto {
  @IsString()
  degree: string;

  @IsString()
  institution: string;

  @IsString()
  year: string;
}

export class EditResumeVersionDto {
  @ValidateNested()
  @Type(() => EditedContactDto)
  contact: EditedContactDto;

  @IsString()
  headline: string;

  @IsString()
  summary: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EditedExperienceItemDto)
  experience: EditedExperienceItemDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EditedProjectItemDto)
  projects: EditedProjectItemDto[];

  @IsArray()
  @IsString({ each: true })
  skills: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EditedEducationItemDto)
  education: EditedEducationItemDto[];

  @IsArray()
  @IsString({ each: true })
  certifications: string[];
}
