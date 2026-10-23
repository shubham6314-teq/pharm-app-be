import { StockStatus } from './inventory.constants.js';

export function resolveBatchStatus(input: {
  quantityOnHand: number;
  expiryDate: Date;
  today: Date;
  expiringUntil: Date;
  productAvailable: number;
  reorderLevel: number;
}): StockStatus {
  if (input.expiryDate < input.today) {
    return StockStatus.EXPIRED;
  }

  if (input.quantityOnHand <= 0) {
    return StockStatus.OUT;
  }

  if (input.expiryDate <= input.expiringUntil) {
    return StockStatus.EXPIRING;
  }

  if (
    input.reorderLevel > 0 &&
    input.productAvailable > 0 &&
    input.productAvailable <= input.reorderLevel
  ) {
    return StockStatus.LOW;
  }

  return StockStatus.IN_STOCK;
}
