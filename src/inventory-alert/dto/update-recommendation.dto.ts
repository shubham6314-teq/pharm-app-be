import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { toNumber } from '../../inventory/dto/transform-strings.js';

export enum RecommendationDecision {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

export class UpdateRecommendationDto {
  @IsEnum(RecommendationDecision)
  decision!: RecommendationDecision;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  quantity?: number;
}
