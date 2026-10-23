import { addUtcDays, startOfInventoryDay } from './inventory-dates.js';
import { resolveBatchStatus } from './inventory-status.js';
import { StockStatus } from './inventory.constants.js';

describe('resolveBatchStatus', () => {
  const today = startOfInventoryDay(new Date('2026-10-23T08:00:00.000Z'));
  const expiringUntil = addUtcDays(today, 90);

  it('marks a past expiry as expired before other states', () => {
    expect(
      resolveBatchStatus({
        quantityOnHand: 0,
        expiryDate: new Date('2026-10-01T00:00:00.000Z'),
        today,
        expiringUntil,
        productAvailable: 0,
        reorderLevel: 5,
      }),
    ).toBe(StockStatus.EXPIRED);
  });

  it('marks a current batch with no packs as out of stock', () => {
    expect(
      resolveBatchStatus({
        quantityOnHand: 0,
        expiryDate: addUtcDays(today, 200),
        today,
        expiringUntil,
        productAvailable: 0,
        reorderLevel: 5,
      }),
    ).toBe(StockStatus.OUT);
  });

  it('marks a batch inside the expiry window as expiring', () => {
    expect(
      resolveBatchStatus({
        quantityOnHand: 4,
        expiryDate: addUtcDays(today, 10),
        today,
        expiringUntil,
        productAvailable: 4,
        reorderLevel: 10,
      }),
    ).toBe(StockStatus.EXPIRING);
  });

  it('marks a healthy batch as low when the product total is at the reorder level', () => {
    expect(
      resolveBatchStatus({
        quantityOnHand: 4,
        expiryDate: addUtcDays(today, 200),
        today,
        expiringUntil,
        productAvailable: 4,
        reorderLevel: 5,
      }),
    ).toBe(StockStatus.LOW);
  });

  it('marks a healthy batch as in stock', () => {
    expect(
      resolveBatchStatus({
        quantityOnHand: 20,
        expiryDate: addUtcDays(today, 200),
        today,
        expiringUntil,
        productAvailable: 20,
        reorderLevel: 5,
      }),
    ).toBe(StockStatus.IN_STOCK);
  });
});
