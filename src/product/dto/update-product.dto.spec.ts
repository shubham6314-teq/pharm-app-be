import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ProductStatus } from '../../generated/prisma/client.js';
import { UpdateProductDto } from './update-product.dto.js';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(UpdateProductDto, plain);
  return validate(dto);
}

describe('UpdateProductDto', () => {
  it('accepts a partial payload', async () => {
    const errors = await validateDto({
      name: 'Updated product',
    });

    expect(errors).toHaveLength(0);
  });

  it('accepts status, pack size, category id, and a nullable description', async () => {
    const dto = plainToInstance(UpdateProductDto, {
      status: ProductStatus.INACTIVE,
      description: null,
      packSize: '10*10 Alu/Alu',
      categoryId: '22222222-2222-4222-8222-222222222222',
    });
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.status).toBe(ProductStatus.INACTIVE);
    expect(dto.description).toBeNull();
    expect(dto.packSize).toBe('10*10 Alu/Alu');
  });

  it('clears a description that is blank after trim', async () => {
    const dto = plainToInstance(UpdateProductDto, {
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

  it('rejects an invalid status, empty pack size, or category id', async () => {
    const errors = await validateDto({
      status: 'ARCHIVED',
      packSize: '   ',
      categoryId: 'not-a-uuid',
    });

    const properties = errors.map((error) => error.property);
    expect(properties).toEqual(
      expect.arrayContaining(['status', 'packSize', 'categoryId']),
    );
  });
});
