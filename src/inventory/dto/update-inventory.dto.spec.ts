import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateInventoryDto } from './update-inventory.dto.js';

async function validateDto(
  plain: Record<string, unknown>,
  options?: Parameters<typeof validate>[1],
) {
  const dto = plainToInstance(UpdateInventoryDto, plain);
  return validate(dto, options);
}

describe('UpdateInventoryDto', () => {
  it('accepts a partial batch correction', async () => {
    const dto = plainToInstance(UpdateInventoryDto, {
      batchNumber: '  b-2  ',
      manufacturingDate: '2026-02-01',
      expiryDate: '2027-02-01',
      purchaseRate: '45.50',
      note: '  Corrected expiry  ',
    });
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.batchNumber).toBe('b-2');
    expect(dto.purchaseRate).toBe(45.5);
    expect(dto.note).toBe('Corrected expiry');
  });

  it('accepts a single field', async () => {
    const errors = await validateDto({
      expiryDate: '2027-06-01',
    });

    expect(errors).toHaveLength(0);
  });

  it('rejects an empty batch number or invalid dates', async () => {
    const errors = await validateDto({
      batchNumber: '   ',
      manufacturingDate: '01-01-2026',
      expiryDate: '2027/01/01',
    });
    const properties = errors.map((error) => error.property);

    expect(properties).toEqual(
      expect.arrayContaining([
        'batchNumber',
        'manufacturingDate',
        'expiryDate',
      ]),
    );
  });

  it('rejects a negative purchase rate', async () => {
    const errors = await validateDto({
      purchaseRate: -1,
    });

    expect(errors.map((error) => error.property)).toContain('purchaseRate');
  });

  it('rejects quantity changes on the update payload', async () => {
    const errors = await validateDto(
      {
        expiryDate: '2027-01-01',
        quantityOnHand: 12,
      },
      { whitelist: true, forbidNonWhitelisted: true },
    );

    expect(errors.some((error) => error.property === 'quantityOnHand')).toBe(
      true,
    );
  });
});
