import { Transform } from 'class-transformer';
import {
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

  @Transform(trimString)
  @IsUUID('4')
  packTypeId: string;

  @Transform(toNumber)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999.99)
  contentQuantity: number;

  @Transform(trimString)
  @IsUUID('4')
  contentUnitId: string;

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
