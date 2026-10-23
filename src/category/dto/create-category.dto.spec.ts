import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCategoryDto } from './create-category.dto.js';

const divisionId = '11111111-1111-4111-8111-111111111111';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(CreateCategoryDto, plain);
  return validate(dto);
}

describe('CreateCategoryDto', () => {
  it('accepts a valid payload with optional fields', async () => {
    const errors = await validateDto({
      name: 'Antihypertensives',
      code: 'ANTIHTN',
      description: 'Blood pressure medicines',
      divisionId,
    });

    expect(errors).toHaveLength(0);
  });

  it('accepts a payload with optional fields omitted', async () => {
    const errors = await validateDto({
      name: 'Antihypertensives',
      code: 'ANTIHTN',
      divisionId,
    });

    expect(errors).toHaveLength(0);
  });

  it('rejects missing required fields', async () => {
    const errors = await validateDto({});

    const properties = errors.map((error) => error.property);
    expect(properties).toEqual(
      expect.arrayContaining(['name', 'code', 'divisionId']),
    );
  });

  it('rejects empty and whitespace-only required fields', async () => {
    const errors = await validateDto({
      name: '   ',
      code: '',
      divisionId: '   ',
    });

    const properties = errors.map((error) => error.property);
    expect(properties).toEqual(
      expect.arrayContaining(['name', 'code', 'divisionId']),
    );
  });

  it('rejects an invalid division id', async () => {
    const errors = await validateDto({
      name: 'Antihypertensives',
      code: 'ANTIHTN',
      divisionId: 'not-a-uuid',
    });

    expect(errors.some((error) => error.property === 'divisionId')).toBe(true);
  });

  it('rejects values that exceed max lengths', async () => {
    const errors = await validateDto({
      name: 'a'.repeat(151),
      code: 'b'.repeat(31),
      divisionId,
    });

    const properties = errors.map((error) => error.property);
    expect(properties).toEqual(expect.arrayContaining(['name', 'code']));
  });

  it('trims whitespace from string fields', async () => {
    const dto = plainToInstance(CreateCategoryDto, {
      name: '  Antihypertensives  ',
      code: '  ANTIHTN  ',
      description: '  Blood pressure medicines  ',
      divisionId: `  ${divisionId}  `,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.name).toBe('Antihypertensives');
    expect(dto.code).toBe('ANTIHTN');
    expect(dto.description).toBe('Blood pressure medicines');
    expect(dto.divisionId).toBe(divisionId);
  });
});
