export const MAX_COPILOT_STEPS = 8;
export const DEFAULT_COPILOT_TIMEOUT_MS = 300_000;
export const DEFAULT_COPILOT_MODEL_TIMEOUT_MS = 300_000;
export const COPILOT_THREAD_NOT_FOUND_MESSAGE = 'Copilot thread not found';
export const COPILOT_MESSAGE_MESSAGE = 'Enter a question';
export const COPILOT_SERVICE_UNAVAILABLE_MESSAGE =
  'The copilot is unavailable.';
export const COPILOT_TIMEOUT_MESSAGE =
  'The copilot took too long. Try again, or look up the product on Inventory.';
export const COPILOT_QUOTA_MESSAGE =
  'Gemini daily quota is used up. Try again later, or look up the product on Inventory.';
export const COPILOT_BUSY_MESSAGE =
  'Gemini is busy. Try again in a moment, or look up the product on Inventory.';
export const COPILOT_UNAVAILABLE_ANSWER =
  'That information is unavailable.';

export const COPILOT_SYSTEM_PROMPT = `You are an inventory copilot for a pharmacy. Answer the pharmacist using only the provided tools.

Rules:
- Call tools to read live catalog, inventory, stock-ledger, low-stock, expiring batches, or uploaded policy documents.
- Live quantities come only from getInventory or listLowStock / listExpiring.
- getConsumption is recorded history, not a forecast.
- If a tool returns no rows or unavailable, say that information is unavailable. Do not invent products, stock, sales, lead times, or policy text.
- Never recommend creating a purchase order, recording a stock movement, or changing quantities. You cannot write inventory.
- Prefer short, factual answers. Name the product code when you cite stock.`;
