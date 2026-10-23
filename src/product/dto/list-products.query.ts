import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { MAX_PRODUCT_PAGE_SIZE } from '../product.constants.js';
import { toNumber, trimOptionalString } from './transform-strings.js';

export class ListProductsQueryDto {
  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(MAX_PRODUCT_PAGE_SIZE)
  limit?: number;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsUUID('4')
  categoryId?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsUUID('4')
  divisionId?: string;
}
