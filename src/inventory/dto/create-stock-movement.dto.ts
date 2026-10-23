import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { StockMovementType } from '../../generated/prisma/client.js';
import {
  toNumber,
  trimOptionalString,
  trimString,
} from './transform-strings.js';

export class CreateStockMovementDto {
  @Transform(trimString)
  @IsUUID('4')
  productId: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  batchNumber: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  manufacturingDate?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  expiryDate?: string;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999999.99)
  purchaseRate?: number;

  @IsEnum(StockMovementType)
  type: StockMovementType;

  @Transform(toNumber)
  @IsInt()
  @Min(-1000000)
  @Max(1000000)
  quantity: number;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(500)
  note?: string;
}
