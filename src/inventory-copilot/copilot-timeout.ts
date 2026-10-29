import {
  COPILOT_BUSY_MESSAGE,
  COPILOT_QUOTA_MESSAGE,
  COPILOT_SERVICE_UNAVAILABLE_MESSAGE,
  COPILOT_TIMEOUT_MESSAGE,
} from './inventory-copilot.constants.js';

export class CopilotTimeoutError extends Error {
  constructor(message = COPILOT_TIMEOUT_MESSAGE) {
    super(message);
    this.name = 'CopilotTimeoutError';
  }
}

export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message = COPILOT_TIMEOUT_MESSAGE,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new CopilotTimeoutError(message)), ms);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export async function* iterateWithIdleTimeout<T>(
  iterable: AsyncIterable<T>,
  idleMs: number,
  message = COPILOT_TIMEOUT_MESSAGE,
): AsyncGenerator<T> {
  const iterator = iterable[Symbol.asyncIterator]();

  while (true) {
    const next = await withTimeout(iterator.next(), idleMs, message);
    if (next.done) {
      return;
    }

    yield next.value;
  }
}

export function copilotPublicError(error: unknown): string {
  if (error instanceof CopilotTimeoutError) {
    return error.message;
  }

  const raw = error instanceof Error ? error.message : String(error);
  const lower = raw.toLowerCase();

  if (
    lower.includes('429') ||
    lower.includes('quota') ||
    lower.includes('too many requests')
  ) {
    return COPILOT_QUOTA_MESSAGE;
  }

  if (lower.includes('503') || lower.includes('high demand')) {
    return COPILOT_BUSY_MESSAGE;
  }

  return COPILOT_SERVICE_UNAVAILABLE_MESSAGE;
}
