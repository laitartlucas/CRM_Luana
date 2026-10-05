import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  // bcrypt só considera os primeiros 72 bytes.
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword!: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword!: string;
}
