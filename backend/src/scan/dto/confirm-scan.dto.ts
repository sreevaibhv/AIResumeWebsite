import { IsArray, IsObject, IsOptional, IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

class ConfirmedContactDto {
  @IsString()
  @IsOptional()
  linkedin?: string;

  @IsString()
  @IsOptional()
  github?: string;
}

/** spec §2.2 — the missing must-have keywords and profile links the user confirmed they actually have. */
export class ConfirmScanDto {
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  skills?: string[] = [];

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => ConfirmedContactDto)
  contact?: ConfirmedContactDto = {};
}
