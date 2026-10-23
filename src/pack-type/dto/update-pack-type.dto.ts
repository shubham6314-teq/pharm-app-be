import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { PackTypeStatus } from '../../generated/prisma/client.js';
import {
  toNumber,
  trimString,
  trimUppercaseString,
} from './transform-strings.js';

export class UpdatePackTypeDto {
  @ValidateIf((_, value) => value !== undefined)
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name?: string;

  @ValidateIf((_, value) => value !== undefined)
  @Transform(trimUppercaseString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  code?: string;

  @ValidateIf((_, value) => value !== undefined)
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  singularLabel?: string;

  @ValidateIf((_, value) => value !== undefined)
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  pluralLabel?: string;

  @ValidateIf((_, value) => value !== undefined)
  @Transform(toNumber)
  @IsInt()
  @Min(0)
  @Max(100000)
  sortOrder?: number;

  @IsOptional()
  @IsEnum(PackTypeStatus)
  status?: PackTypeStatus;
}
