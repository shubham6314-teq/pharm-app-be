import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CategoryStatus } from '../../generated/prisma/client.js';
import { UpdateCategoryDto } from './update-category.dto.js';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(UpdateCategoryDto, plain);
  return validate(dto);
}

describe('UpdateCategoryDto', () => {
  it('accepts a partial payload', async () => {
    const errors = await validateDto({
      name: 'Updated category',
    });

    expect(errors).toHaveLength(0);
  });

  it('accepts status, division id, and a nullable description', async () => {
    const dto = plainToInstance(UpdateCategoryDto, {
      status: CategoryStatus.INACTIVE,
      description: null,
      divisionId: '11111111-1111-4111-8111-111111111111',
    });
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.status).toBe(CategoryStatus.INACTIVE);
    expect(dto.description).toBeNull();
  });

  it('clears a description that is blank after trim', async () => {
    const dto = plainToInstance(UpdateCategoryDto, {
      description: '   ',
    });
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.description).toBeNull();
  });

  it('rejects empty name or code', async () => {
    const errors = await validateDto({
      name: '   ',
      code: '',
    });

    const properties = errors.map((error) => error.property);
    expect(properties).toEqual(expect.arrayContaining(['name', 'code']));
  });

  it('rejects an invalid status or division id', async () => {
    const errors = await validateDto({
      status: 'ARCHIVED',
      divisionId: 'not-a-uuid',
    });

    const properties = errors.map((error) => error.property);
    expect(properties).toEqual(expect.arrayContaining(['status', 'divisionId']));
  });
});
