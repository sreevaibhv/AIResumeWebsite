import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";

export class CreateScanDto {
  @IsString()
  @MinLength(20, { message: "Resume text looks too short to be a real resume." })
  resumeText: string;

  @IsString()
  @MinLength(20, { message: "JD text looks too short to be a real job description." })
  jdText: string;

  @IsBoolean()
  @IsOptional()
  fresherMode?: boolean = false;
}
