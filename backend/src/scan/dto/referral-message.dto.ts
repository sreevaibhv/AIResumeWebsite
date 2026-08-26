import { IsOptional, IsString } from "class-validator";

export class ReferralMessageDto {
  @IsString()
  @IsOptional()
  contactName?: string;
}
