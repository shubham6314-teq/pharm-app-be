import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateProductDto } from './create-product.dto.js';

const categoryId = '22222222-2222-4222-8222-222222222222';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(CreateProductDto, plain);
  return validate(dto);
}

describe('CreateProductDto', () => {
  it('accepts a valid payload with optional fields', async () => {
    const errors = await validateDto({
      name: 'Crocin',
      code: 'CRO100ML',
      description: 'Paracetamol syrup',
      brandName: 'GSK',
      composition: 'Paracetamol 125 mg/5 ml',
      packSize: '4*5*2 ml Respules',
      packUnit: 'BOTTLE',
      contentQuantity: 100,
      contentUnit: 'ML',
      reorderLevel: 10,
      mrp: 80.5,
      discountPercent: 10,
      categoryId,
    });

    expect(errors).toHaveLength(0);
  });

  it('accepts multipart string numbers and omitted optional fields', async () => {
    const dto = plainToInstance(CreateProductDto, {
      name: 'Crocin',
      code: 'CRO100ML',
      brandName: 'GSK',
      composition: 'Paracetamol 125 mg/5 ml',
      packSize: '10*10 Blister',
      packUnit: 'STRIP',
      contentQuantity: '10',
      contentUnit: 'TABLET',
      mrp: '120.00',
      categoryId,
    });
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.packSize).toBe('10*10 Blister');
    expect(dto.mrp).toBe(120);
  });

  it('rejects missing required fields', async () => {
    const errors = await validateDto({});

    const properties = errors.map((error) => error.property);
    expect(properties).toEqual(
      expect.arrayContaining([
        'name',
        'code',
        'brandName',
        'composition',
        'packSize',
        'packUnit',
        'contentQuantity',
        'contentUnit',
        'mrp',
        'categoryId',
      ]),
    );
  });

  it('rejects empty and whitespace-only required fields', async () => {
    const errors = await validateDto({
      name: '   ',
      code: '',
      brandName: '  ',
      composition: '',
      packSize: '   ',
      mrp: 80,
      categoryId: '   ',
    });

    const properties = errors.map((error) => error.property);
    expect(properties).toEqual(
      expect.arrayContaining([
        'name',
        'code',
        'brandName',
        'composition',
        'packSize',
        'categoryId',
      ]),
    );
  });

  it('rejects invalid pack size, price, and category values', async () => {
    const errors = await validateDto({
      name: 'Crocin',
      code: 'CRO100ML',
      brandName: 'GSK',
      composition: 'Paracetamol 125 mg/5 ml',
      packSize: 'a'.repeat(101),
      mrp: -1,
      discountPercent: 101,
      categoryId: 'not-a-uuid',
    });

    const properties = errors.map((error) => error.property);
    expect(properties).toEqual(
      expect.arrayContaining([
        'packSize',
        'mrp',
        'discountPercent',
        'categoryId',
      ]),
    );
  });

  it('trims whitespace from string fields', async () => {
    const dto = plainToInstance(CreateProductDto, {
      name: '  Crocin  ',
      code: '  CRO100ML  ',
      description: '  Paracetamol syrup  ',
      brandName: '  GSK  ',
      composition: '  Paracetamol 125 mg/5 ml  ',
      packSize: '  200 ML  ',
      packUnit: 'BOTTLE',
      contentQuantity: 100,
      contentUnit: 'ML',
      mrp: 80,
      categoryId: `  ${categoryId}  `,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.name).toBe('Crocin');
    expect(dto.code).toBe('CRO100ML');
    expect(dto.description).toBe('Paracetamol syrup');
    expect(dto.brandName).toBe('GSK');
    expect(dto.composition).toBe('Paracetamol 125 mg/5 ml');
    expect(dto.packSize).toBe('200 ML');
    expect(dto.categoryId).toBe(categoryId);
  });
});
