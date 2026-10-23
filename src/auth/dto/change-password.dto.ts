import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { PASSWORD_MISMATCH_MESSAGE } from '../auth.constants.js';
import { Match } from './match.decorator.js';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  currentPassword: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  @Match('newPassword', { message: PASSWORD_MISMATCH_MESSAGE })
  confirmPassword: string;
}
