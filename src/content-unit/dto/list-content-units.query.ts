import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { MAX_CONTENT_UNIT_PAGE_SIZE } from '../content-unit.constants.js';
import { toNumber } from './transform-strings.js';

export class ListContentUnitsQueryDto {
  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(MAX_CONTENT_UNIT_PAGE_SIZE)
  limit?: number;
}
