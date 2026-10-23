import { PasswordService } from './password.service.js';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes a password so the original value is not stored', async () => {
    const hash = await service.hash('secret-password');

    expect(hash).not.toBe('secret-password');
    expect(hash.startsWith('$2')).toBe(true);
  });

  it('accepts the original password against its hash', async () => {
    const hash = await service.hash('secret-password');

    await expect(service.compare('secret-password', hash)).resolves.toBe(true);
  });

  it('rejects a different password', async () => {
    const hash = await service.hash('secret-password');

    await expect(service.compare('other-password', hash)).resolves.toBe(false);
  });
});
