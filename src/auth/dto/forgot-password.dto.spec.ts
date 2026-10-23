import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ForgotPasswordDto } from './forgot-password.dto.js';

describe('ForgotPasswordDto', () => {
  it('normalizes email', async () => {
    const dto = plainToInstance(ForgotPasswordDto, {
      email: '  Pharmacist@Example.com  ',
    });
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.email).toBe('pharmacist@example.com');
  });

  it('rejects an invalid email', async () => {
    const dto = plainToInstance(ForgotPasswordDto, { email: 'not-an-email' });
    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'email')).toBe(true);
  });
});
