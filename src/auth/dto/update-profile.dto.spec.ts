import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateProfileDto } from './update-profile.dto.js';

describe('UpdateProfileDto', () => {
  it('accepts a valid payload', async () => {
    const dto = plainToInstance(UpdateProfileDto, {
      name: 'Pharmacist',
      email: 'pharmacist@example.com',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('trims the name and normalizes the email', async () => {
    const dto = plainToInstance(UpdateProfileDto, {
      name: '  Pharmacist  ',
      email: '  Pharmacist@Example.com  ',
    });
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.name).toBe('Pharmacist');
    expect(dto.email).toBe('pharmacist@example.com');
  });

  it('rejects an empty name', async () => {
    const dto = plainToInstance(UpdateProfileDto, {
      name: '   ',
      email: 'pharmacist@example.com',
    });
    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'name')).toBe(true);
  });

  it('rejects an invalid email', async () => {
    const dto = plainToInstance(UpdateProfileDto, {
      name: 'Pharmacist',
      email: 'not-an-email',
    });
    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'email')).toBe(true);
  });
});
