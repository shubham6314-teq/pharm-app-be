import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListCategoriesQueryDto } from './list-categories.query.js';

async function validateQuery(plain: Record<string, unknown>) {
  const dto = plainToInstance(ListCategoriesQueryDto, plain);
  return validate(dto);
}

describe('ListCategoriesQueryDto', () => {
  it('accepts omitted query params', async () => {
    const errors = await validateQuery({});

    expect(errors).toHaveLength(0);
  });

  it('accepts valid page, limit, and division id', async () => {
    const dto = plainToInstance(ListCategoriesQueryDto, {
      page: '2',
      limit: '20',
      divisionId: '11111111-1111-4111-8111-111111111111',
    });
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(20);
    expect(dto.divisionId).toBe('11111111-1111-4111-8111-111111111111');
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

  it('rejects an invalid division id', async () => {
    const errors = await validateQuery({
      divisionId: 'not-a-uuid',
    });

    expect(errors.some((error) => error.property === 'divisionId')).toBe(true);
  });
});
