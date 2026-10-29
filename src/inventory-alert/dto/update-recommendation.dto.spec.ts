import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  RecommendationDecision,
  UpdateRecommendationDto,
} from './update-recommendation.dto.js';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(UpdateRecommendationDto, plain);
  return validate(dto);
}

describe('UpdateRecommendationDto', () => {
  it('accepts approve without a quantity', async () => {
    const errors = await validateDto({
      decision: RecommendationDecision.APPROVE,
    });

    expect(errors).toHaveLength(0);
  });

  it('accepts a positive edited quantity', async () => {
    const errors = await validateDto({
      decision: RecommendationDecision.APPROVE,
      quantity: '8',
    });

    expect(errors).toHaveLength(0);
  });

  it('rejects a non-positive quantity', async () => {
    const errors = await validateDto({
      decision: RecommendationDecision.APPROVE,
      quantity: 0,
    });

    expect(errors.some((error) => error.property === 'quantity')).toBe(true);
  });
});
