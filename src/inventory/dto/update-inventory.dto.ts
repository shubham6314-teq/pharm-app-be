import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  toNumber,
  trimOptionalString,
  trimString,
} from './transform-strings.js';

export class UpdateInventoryDto {
  @ValidateIf((_, value) => value !== undefined)
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  batchNumber?: string;

  @ValidateIf((_, value) => value !== undefined)
  @Transform(trimString)
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  manufacturingDate?: string;

  @ValidateIf((_, value) => value !== undefined)
  @Transform(trimString)
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  expiryDate?: string;

  @ValidateIf((_, value) => value !== undefined)
  @Transform(toNumber)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999999.99)
  purchaseRate?: number;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(500)
  note?: string;
}
