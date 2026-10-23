import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  toNumber,
  trimString,
  trimUppercaseString,
} from './transform-strings.js';

export class CreateContentUnitDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  @Transform(trimUppercaseString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  code: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  singularLabel: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  pluralLabel: string;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(0)
  @Max(100000)
  sortOrder?: number;
}
