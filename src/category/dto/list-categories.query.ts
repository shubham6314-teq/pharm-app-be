import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { MAX_CATEGORY_PAGE_SIZE } from '../category.constants.js';
import { trimOptionalString } from './transform-strings.js';

function toInteger({ value }: { value: unknown }): unknown {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? value : parsed;
}

export class ListCategoriesQueryDto {
  @IsOptional()
  @Transform(toInteger)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(toInteger)
  @IsInt()
  @Min(1)
  @Max(MAX_CATEGORY_PAGE_SIZE)
  limit?: number;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsUUID('4')
  divisionId?: string;
}
