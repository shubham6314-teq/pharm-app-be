import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { TokenService } from './token.service.js';

describe('TokenService', () => {
  let service: TokenService;

  beforeEach(() => {
    const configService = {
      getOrThrow: (key: string) => {
        if (key === 'JWT_ACCESS_SECRET') {
          return 'test-access-secret-at-least-32-characters';
        }
        if (key === 'JWT_REFRESH_SECRET') {
          return 'test-refresh-secret-at-least-32-characters';
        }
        throw new Error(`Missing ${key}`);
      },
      get: (key: string) => {
        if (key === 'JWT_ACCESS_TTL_SECONDS') {
          return '900';
        }
        if (key === 'JWT_REFRESH_TTL_SECONDS') {
          return '604800';
        }
        return undefined;
      },
    } as unknown as ConfigService;

    service = new TokenService(new JwtService(), configService);
  });

  it('signs and verifies an access token', async () => {
    const token = await service.signAccessToken({
      sub: 'user-1',
      email: 'pharmacist@example.com',
    });
    const payload = await service.verifyAccessToken(token);

    expect(payload).toMatchObject({
      sub: 'user-1',
      email: 'pharmacist@example.com',
      typ: 'access',
    });
  });

  it('signs and verifies a refresh token', async () => {
    const token = await service.signRefreshToken({
      sub: 'user-1',
      email: 'pharmacist@example.com',
      jti: 'token-1',
    });
    const payload = await service.verifyRefreshToken(token);

    expect(payload).toMatchObject({
      sub: 'user-1',
      email: 'pharmacist@example.com',
      jti: 'token-1',
      typ: 'refresh',
    });
  });

  it('rejects an access token used as a refresh token', async () => {
    const accessToken = await service.signAccessToken({
      sub: 'user-1',
      email: 'pharmacist@example.com',
    });

    await expect(service.verifyRefreshToken(accessToken)).rejects.toThrow();
  });

  it('hashes tokens and compares them in constant time', () => {
    const hash = service.hashToken('refresh-token');

    expect(hash).not.toBe('refresh-token');
    expect(service.areHashesEqual(hash, service.hashToken('refresh-token'))).toBe(
      true,
    );
    expect(service.areHashesEqual(hash, service.hashToken('other-token'))).toBe(
      false,
    );
  });
});
