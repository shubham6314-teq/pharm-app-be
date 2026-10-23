import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  MAX_INVENTORY_PAGE_SIZE,
  StockStatus,
} from '../inventory.constants.js';
import {
  toNumber,
  trimOptionalString,
} from './transform-strings.js';

export class ListInventoryQueryDto {
  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(MAX_INVENTORY_PAGE_SIZE)
  limit?: number;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsUUID('4')
  divisionId?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsUUID('4')
  categoryId?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsUUID('4')
  productId?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(StockStatus)
  status?: StockStatus;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(365)
  expiringWithinDays?: number;
}
