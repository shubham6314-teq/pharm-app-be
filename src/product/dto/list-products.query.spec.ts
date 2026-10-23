import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListProductsQueryDto } from './list-products.query.js';

async function validateQuery(plain: Record<string, unknown>) {
  const dto = plainToInstance(ListProductsQueryDto, plain);
  return validate(dto);
}

describe('ListProductsQueryDto', () => {
  it('accepts omitted query params', async () => {
    const errors = await validateQuery({});

    expect(errors).toHaveLength(0);
  });

  it('accepts valid page, limit, category id, and division id', async () => {
    const dto = plainToInstance(ListProductsQueryDto, {
      page: '2',
      limit: '20',
      categoryId: '22222222-2222-4222-8222-222222222222',
      divisionId: '11111111-1111-4111-8111-111111111111',
    });
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(20);
    expect(dto.categoryId).toBe('22222222-2222-4222-8222-222222222222');
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

  it('rejects an invalid category or division id', async () => {
    const errors = await validateQuery({
      categoryId: 'not-a-uuid',
      divisionId: 'also-bad',
    });

    const properties = errors.map((error) => error.property);
    expect(properties).toEqual(
      expect.arrayContaining(['categoryId', 'divisionId']),
    );
  });
});
