import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from "class-validator";

export enum TierDto {
  Startup = "Startup",
  MNC = "MNC",
  PSU = "PSU",
  Government = "Government",
}

export class CreateScanDto {
  @IsString()
  @MinLength(20, { message: "Resume text looks too short to be a real resume." })
  resumeText: string;

  @IsString()
  @MinLength(20, { message: "JD text looks too short to be a real job description." })
  jdText: string;

  @IsEnum(TierDto)
  @IsOptional()
  tier?: TierDto = TierDto.Startup;

  @IsBoolean()
  @IsOptional()
  fresherMode?: boolean = false;
}
