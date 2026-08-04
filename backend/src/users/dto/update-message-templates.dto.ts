import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateMessageTemplatesDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  newLeadOutreach?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reminder24h?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reminder3h?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reminder1h?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  postServiceFollowUp?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  noShowReengagement?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  renewalReminder?: string;
}
