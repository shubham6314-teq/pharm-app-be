import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { TokenService } from '../token.service.js';

describe('JwtAuthGuard', () => {
  const tokenService = {
    verifyAccessToken: vi.fn(),
  };
  const reflector = {
    getAllAndOverride: vi.fn(),
  };
  const guard = new JwtAuthGuard(
    reflector as unknown as Reflector,
    tokenService as unknown as TokenService,
  );

  function createContext(authorization?: string): ExecutionContext {
    const request = {
      headers: authorization ? { authorization } : {},
    };

    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as ExecutionContext;
  }

  beforeEach(() => {
    tokenService.verifyAccessToken.mockReset();
    reflector.getAllAndOverride.mockReset();
    reflector.getAllAndOverride.mockReturnValue(false);
  });

  it('allows public routes without a token', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);

    await expect(guard.canActivate(createContext())).resolves.toBe(true);
    expect(tokenService.verifyAccessToken).not.toHaveBeenCalled();
  });

  it('attaches the access token payload to the request', async () => {
    const payload = {
      sub: 'user-1',
      email: 'pharmacist@example.com',
      typ: 'access',
    };
    tokenService.verifyAccessToken.mockResolvedValue(payload);
    const context = createContext('Bearer access-token');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(context.switchToHttp().getRequest().user).toEqual(payload);
  });

  it('rejects a missing bearer token', async () => {
    await expect(guard.canActivate(createContext())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects an invalid access token', async () => {
    tokenService.verifyAccessToken.mockRejectedValue(new Error('invalid'));

    await expect(
      guard.canActivate(createContext('Bearer bad-token')),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
