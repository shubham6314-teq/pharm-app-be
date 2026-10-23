import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginDto } from './login.dto.js';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(LoginDto, plain);
  return validate(dto);
}

describe('LoginDto', () => {
  it('accepts a valid email and password', async () => {
    const errors = await validateDto({
      email: 'pharmacist@example.com',
      password: 'secret-password',
    });

    expect(errors).toHaveLength(0);
  });

  it('normalizes email by trimming and lowercasing', async () => {
    const dto = plainToInstance(LoginDto, {
      email: '  Pharmacist@Example.com  ',
      password: 'secret-password',
    });
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.email).toBe('pharmacist@example.com');
  });

  it('rejects missing fields', async () => {
    const errors = await validateDto({});
    const properties = errors.map((error) => error.property);

    expect(properties).toEqual(expect.arrayContaining(['email', 'password']));
  });

  it('rejects an invalid email', async () => {
    const errors = await validateDto({
      email: 'not-an-email',
      password: 'secret-password',
    });

    expect(errors.some((error) => error.property === 'email')).toBe(true);
  });

  it('rejects an empty password', async () => {
    const errors = await validateDto({
      email: 'pharmacist@example.com',
      password: '',
    });

    expect(errors.some((error) => error.property === 'password')).toBe(true);
  });
});
