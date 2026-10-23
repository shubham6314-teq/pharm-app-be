import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PASSWORD_MISMATCH_MESSAGE } from '../auth.constants.js';
import { ChangePasswordDto } from './change-password.dto.js';

describe('ChangePasswordDto', () => {
  it('accepts a valid payload', async () => {
    const dto = plainToInstance(ChangePasswordDto, {
      currentPassword: 'old-password',
      newPassword: 'new-password',
      confirmPassword: 'new-password',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects a short new password', async () => {
    const dto = plainToInstance(ChangePasswordDto, {
      currentPassword: 'old-password',
      newPassword: 'short',
      confirmPassword: 'short',
    });
    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'newPassword')).toBe(true);
  });

  it('rejects when confirm password does not match', async () => {
    const dto = plainToInstance(ChangePasswordDto, {
      currentPassword: 'old-password',
      newPassword: 'new-password',
      confirmPassword: 'other-password',
    });
    const errors = await validate(dto);
    const confirmError = errors.find(
      (error) => error.property === 'confirmPassword',
    );

    expect(confirmError?.constraints).toMatchObject({
      match: PASSWORD_MISMATCH_MESSAGE,
    });
  });
});
