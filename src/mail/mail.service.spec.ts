import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service.js';

describe('MailService', () => {
  it('sends through json transport when SMTP_HOST is missing', async () => {
    const configService = {
      get: (key: string) => {
        if (key === 'MAIL_FROM') {
          return 'Pharma App <noreply@localhost>';
        }
        return undefined;
      },
    } as unknown as ConfigService;

    const service = new MailService(configService);

    await expect(
      service.sendPasswordReset(
        'pharmacist@example.com',
        'http://localhost:3000/reset-password?token=abc',
      ),
    ).resolves.toBeUndefined();
  });
});
