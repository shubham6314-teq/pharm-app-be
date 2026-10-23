import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { MAX_DIVISION_PAGE_SIZE } from '../division.constants.js';

function toInteger({ value }: { value: unknown }): unknown {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? value : parsed;
}

export class ListDivisionsQueryDto {
  @IsOptional()
  @Transform(toInteger)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(toInteger)
  @IsInt()
  @Min(1)
  @Max(MAX_DIVISION_PAGE_SIZE)
  limit?: number;
}
