export const DEFAULT_INVENTORY_PAGE = 1;
export const DEFAULT_INVENTORY_PAGE_SIZE = 10;
export const MAX_INVENTORY_PAGE_SIZE = 100;
export const DEFAULT_EXPIRING_WITHIN_DAYS = 90;

export const StockStatus = {
  IN_STOCK: 'IN_STOCK',
  LOW: 'LOW',
  OUT: 'OUT',
  EXPIRED: 'EXPIRED',
  EXPIRING: 'EXPIRING',
} as const;

export type StockStatus = (typeof StockStatus)[keyof typeof StockStatus];

export const INVENTORY_PRODUCT_NOT_FOUND_MESSAGE =
  'Selected product was not found';
export const INVENTORY_BATCH_NOT_FOUND_MESSAGE = 'Inventory batch not found';
export const INVENTORY_BATCH_EXISTS_MESSAGE =
  'This batch number already exists for the product';
export const INVENTORY_NEW_BATCH_FIELDS_MESSAGE =
  'Manufacturing date, expiry date, and purchase rate are required for a new batch';
export const INVENTORY_NEW_BATCH_TYPE_MESSAGE =
  'A new batch can only be recorded as opening stock or a purchase';
export const INVENTORY_EXPIRY_BEFORE_MANUFACTURING_MESSAGE =
  'Expiry date must be on or after the manufacturing date';
export const INVENTORY_INVALID_DATE_MESSAGE =
  'Use a valid date in YYYY-MM-DD format';
export const INVENTORY_QUANTITY_MESSAGE =
  'Quantity must be a positive whole number, or a non-zero whole number for an adjustment';
export const INVENTORY_INSUFFICIENT_QUANTITY_MESSAGE =
  'This batch does not have enough packs for that movement';
export const INVENTORY_UPDATE_EMPTY_MESSAGE =
  'At least one batch field must be provided';
