export const DEFAULT_ALERT_PAGE = 1;
export const DEFAULT_ALERT_PAGE_SIZE = 10;
export const MAX_ALERT_PAGE_SIZE = 100;

export const INVENTORY_ALERT_CREATED = 'inventory.alert.created';
export const INVENTORY_ALERT_RESOLVED = 'inventory.alert.resolved';
export const INVENTORY_ALERT_ANALYSIS_READY = 'inventory.alert.analysis_ready';
export const INVENTORY_ALERT_ANALYSIS_FAILED = 'inventory.alert.analysis_failed';

export const INVENTORY_ALERT_NOT_FOUND_MESSAGE = 'Inventory alert not found';
export const INVENTORY_ALERT_DISMISS_MESSAGE =
  'This alert can no longer be dismissed';
export const INVENTORY_ALERT_RECOMMENDATION_MESSAGE =
  'This recommendation can no longer be decided';
export const INVENTORY_ALERT_RECOMMENDATION_QUANTITY_MESSAGE =
  'Enter a quantity to approve';

export type InventoryAlertEvent = {
  alertId: string;
  productId: string;
};
