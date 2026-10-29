import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { trimString } from '../../inventory/dto/transform-strings.js';
import { COPILOT_MESSAGE_MESSAGE } from '../inventory-copilot.constants.js';

export class CreateCopilotMessageDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1, { message: COPILOT_MESSAGE_MESSAGE })
  @MaxLength(2000)
  content!: string;
}
