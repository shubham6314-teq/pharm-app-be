import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ContentUnit, PackUnit } from '../../generated/prisma/client.js';
import { toNumber, trimOptionalString, trimString } from './transform-strings.js';

export class CreateProductDto {
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
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  brandName: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  composition: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  packSize: string;

  @IsEnum(PackUnit)
  packUnit: PackUnit;

  @Transform(toNumber)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999.99)
  contentQuantity: number;

  @IsEnum(ContentUnit)
  contentUnit: ContentUnit;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(0)
  @Max(1000000)
  reorderLevel?: number;

  @Transform(toNumber)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  mrp: number;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @Transform(trimString)
  @IsUUID('4')
  categoryId: string;
}
