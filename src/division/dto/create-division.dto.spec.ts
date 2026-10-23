import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateDivisionDto } from './create-division.dto.js';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(CreateDivisionDto, plain);
  return validate(dto);
}

describe('CreateDivisionDto', () => {
  it('accepts a valid payload with optional fields', async () => {
    const errors = await validateDto({
      name: 'Cardiology Division',
      code: 'CARD',
      description: 'Heart and blood pressure medicines',
    });

    expect(errors).toHaveLength(0);
  });

  it('accepts a payload with optional fields omitted', async () => {
    const errors = await validateDto({
      name: 'Cardiology Division',
      code: 'CARD',
    });

    expect(errors).toHaveLength(0);
  });

  it('rejects missing required fields', async () => {
    const errors = await validateDto({});

    const properties = errors.map((error) => error.property);
    expect(properties).toEqual(expect.arrayContaining(['name', 'code']));
  });

  it('rejects empty and whitespace-only required fields', async () => {
    const errors = await validateDto({
      name: '   ',
      code: '',
    });

    const properties = errors.map((error) => error.property);
    expect(properties).toEqual(expect.arrayContaining(['name', 'code']));
  });

  it('rejects invalid field types', async () => {
    const errors = await validateDto({
      name: 123,
      code: true,
      description: 45,
    });

    const properties = errors.map((error) => error.property);
    expect(properties).toEqual(
      expect.arrayContaining(['name', 'code', 'description']),
    );
  });

  it('rejects values that exceed max lengths', async () => {
    const errors = await validateDto({
      name: 'a'.repeat(151),
      code: 'b'.repeat(31),
    });

    const properties = errors.map((error) => error.property);
    expect(properties).toEqual(expect.arrayContaining(['name', 'code']));
  });

  it('trims whitespace from string fields', async () => {
    const dto = plainToInstance(CreateDivisionDto, {
      name: '  Cardiology Division  ',
      code: '  CARD  ',
      description: '  Heart medicines  ',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.name).toBe('Cardiology Division');
    expect(dto.code).toBe('CARD');
    expect(dto.description).toBe('Heart medicines');
  });
});
