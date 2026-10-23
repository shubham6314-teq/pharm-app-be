import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { MAX_PACK_TYPE_PAGE_SIZE } from '../pack-type.constants.js';
import { toNumber } from './transform-strings.js';

export class ListPackTypesQueryDto {
  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(MAX_PACK_TYPE_PAGE_SIZE)
  limit?: number;
}
