import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { trimOptionalString, trimString } from './transform-strings.js';

export class CreateCategoryDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  code: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  description?: string;

  @Transform(trimString)
  @IsUUID('4')
  divisionId: string;
}
