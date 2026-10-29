import { CopilotTimeoutError, copilotPublicError, withTimeout } from './copilot-timeout.js';
import {
  COPILOT_QUOTA_MESSAGE,
  COPILOT_TIMEOUT_MESSAGE,
} from './inventory-copilot.constants.js';

describe('copilot timeout', () => {
  it('rejects when the work exceeds the limit', async () => {
    await expect(
      withTimeout(new Promise(() => undefined), 20, COPILOT_TIMEOUT_MESSAGE),
    ).rejects.toBeInstanceOf(CopilotTimeoutError);
  });

  it('maps Gemini quota errors to a short public message', () => {
    expect(
      copilotPublicError(
        new Error('[429 Too Many Requests] quota exceeded generate_content_free_tier'),
      ),
    ).toBe(COPILOT_QUOTA_MESSAGE);
  });
});
