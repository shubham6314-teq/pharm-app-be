import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DivisionStatus } from '../../generated/prisma/client.js';
import { UpdateDivisionDto } from './update-division.dto.js';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(UpdateDivisionDto, plain);
  return validate(dto);
}

describe('UpdateDivisionDto', () => {
  it('accepts a partial payload', async () => {
    const errors = await validateDto({
      name: 'Updated Cardiology',
    });

    expect(errors).toHaveLength(0);
  });

  it('accepts status and a nullable description', async () => {
    const dto = plainToInstance(UpdateDivisionDto, {
      status: DivisionStatus.INACTIVE,
      description: null,
    });
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.status).toBe(DivisionStatus.INACTIVE);
    expect(dto.description).toBeNull();
  });

  it('clears a description that is blank after trim', async () => {
    const dto = plainToInstance(UpdateDivisionDto, {
      description: '   ',
    });
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.description).toBeNull();
  });

  it('trims provided string fields', async () => {
    const dto = plainToInstance(UpdateDivisionDto, {
      name: '  Updated Cardiology  ',
      code: '  CARD2  ',
      description: '  Updated description  ',
    });
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.name).toBe('Updated Cardiology');
    expect(dto.code).toBe('CARD2');
    expect(dto.description).toBe('Updated description');
  });

  it('rejects empty name or code', async () => {
    const errors = await validateDto({
      name: '   ',
      code: '',
    });

    const properties = errors.map((error) => error.property);
    expect(properties).toEqual(expect.arrayContaining(['name', 'code']));
  });

  it('rejects null name or code', async () => {
    const errors = await validateDto({
      name: null,
      code: null,
    });

    const properties = errors.map((error) => error.property);
    expect(properties).toEqual(expect.arrayContaining(['name', 'code']));
  });

  it('rejects an invalid status', async () => {
    const errors = await validateDto({
      status: 'ARCHIVED',
    });

    expect(errors.some((error) => error.property === 'status')).toBe(true);
  });

  it('rejects values that exceed max lengths', async () => {
    const errors = await validateDto({
      name: 'a'.repeat(151),
      code: 'b'.repeat(31),
    });

    const properties = errors.map((error) => error.property);
    expect(properties).toEqual(expect.arrayContaining(['name', 'code']));
  });
});
