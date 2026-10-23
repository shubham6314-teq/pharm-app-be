import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { CategoryStatus } from '../../generated/prisma/client.js';
import { trimNullableString, trimString } from './transform-strings.js';

export class UpdateCategoryDto {
  @ValidateIf((_, value) => value !== undefined)
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @ValidateIf((_, value) => value !== undefined)
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  code?: string;

  @IsOptional()
  @Transform(trimNullableString)
  @ValidateIf((_, value) => value !== null)
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsEnum(CategoryStatus)
  status?: CategoryStatus;

  @ValidateIf((_, value) => value !== undefined)
  @Transform(trimString)
  @IsUUID('4')
  divisionId?: string;
}
