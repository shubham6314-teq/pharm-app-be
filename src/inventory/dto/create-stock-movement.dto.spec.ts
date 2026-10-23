import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { StockMovementType } from '../../generated/prisma/client.js';
import { CreateStockMovementDto } from './create-stock-movement.dto.js';

const productId = '33333333-3333-4333-8333-333333333333';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(CreateStockMovementDto, plain);
  return validate(dto);
}

describe('CreateStockMovementDto', () => {
  it('accepts a new batch payload', async () => {
    const dto = plainToInstance(CreateStockMovementDto, {
      productId,
      batchNumber: '  b-1  ',
      manufacturingDate: '2026-01-01',
      expiryDate: '2027-01-01',
      purchaseRate: '40.50',
      type: StockMovementType.OPENING,
      quantity: '10',
      note: '  Opening  ',
    });
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.batchNumber).toBe('b-1');
    expect(dto.purchaseRate).toBe(40.5);
    expect(dto.quantity).toBe(10);
    expect(dto.note).toBe('Opening');
  });

  it('accepts a negative adjustment', async () => {
    const errors = await validateDto({
      productId,
      batchNumber: 'B-1',
      type: StockMovementType.ADJUSTMENT,
      quantity: -2,
    });

    expect(errors).toHaveLength(0);
  });

  it('rejects a missing product, batch, type, or quantity', async () => {
    const errors = await validateDto({});
    const properties = errors.map((error) => error.property);

    expect(properties).toEqual(
      expect.arrayContaining(['productId', 'batchNumber', 'type', 'quantity']),
    );
  });
});
