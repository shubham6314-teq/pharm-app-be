import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ResetPasswordDto } from './reset-password.dto.js';

describe('ResetPasswordDto', () => {
  it('accepts a valid payload', async () => {
    const dto = plainToInstance(ResetPasswordDto, {
      token: 'reset-token',
      newPassword: 'new-password',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects a missing token', async () => {
    const dto = plainToInstance(ResetPasswordDto, {
      newPassword: 'new-password',
    });
    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'token')).toBe(true);
  });
});
