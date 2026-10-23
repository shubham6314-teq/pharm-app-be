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
  ValidateIf,
} from 'class-validator';
import { ProductStatus } from '../../generated/prisma/client.js';
import { toNumber, trimNullableString, trimString } from './transform-strings.js';

export class UpdateProductDto {
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

  @ValidateIf((_, value) => value !== undefined)
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  brandName?: string;

  @ValidateIf((_, value) => value !== undefined)
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  composition?: string;

  @ValidateIf((_, value) => value !== undefined)
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  packSize?: string;

  @ValidateIf((_, value) => value !== undefined)
  @Transform(trimString)
  @IsUUID('4')
  packTypeId?: string;

  @ValidateIf((_, value) => value !== undefined)
  @Transform(toNumber)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999.99)
  contentQuantity?: number;

  @ValidateIf((_, value) => value !== undefined)
  @Transform(trimString)
  @IsUUID('4')
  contentUnitId?: string;

  @ValidateIf((_, value) => value !== undefined)
  @Transform(toNumber)
  @IsInt()
  @Min(0)
  @Max(1000000)
  reorderLevel?: number;

  @ValidateIf((_, value) => value !== undefined)
  @Transform(toNumber)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  mrp?: number;

  @ValidateIf((_, value) => value !== undefined)
  @Transform(toNumber)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ValidateIf((_, value) => value !== undefined)
  @Transform(trimString)
  @IsUUID('4')
  categoryId?: string;
}
