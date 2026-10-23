import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListDivisionsQueryDto } from './list-divisions.query.js';

async function validateQuery(plain: Record<string, unknown>) {
  const dto = plainToInstance(ListDivisionsQueryDto, plain);
  return validate(dto);
}

describe('ListDivisionsQueryDto', () => {
  it('accepts omitted pagination params', async () => {
    const errors = await validateQuery({});

    expect(errors).toHaveLength(0);
  });

  it('accepts valid page and limit', async () => {
    const dto = plainToInstance(ListDivisionsQueryDto, {
      page: '2',
      limit: '20',
    });
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(20);
  });

  it('rejects page or limit below 1', async () => {
    const errors = await validateQuery({
      page: 0,
      limit: 0,
    });

    const properties = errors.map((error) => error.property);
    expect(properties).toEqual(expect.arrayContaining(['page', 'limit']));
  });

  it('rejects a limit above 100', async () => {
    const errors = await validateQuery({
      limit: 101,
    });

    expect(errors.some((error) => error.property === 'limit')).toBe(true);
  });

  it('rejects non-integer pagination values', async () => {
    const errors = await validateQuery({
      page: 1.5,
      limit: 'ten',
    });

    const properties = errors.map((error) => error.property);
    expect(properties).toEqual(expect.arrayContaining(['page', 'limit']));
  });
});
