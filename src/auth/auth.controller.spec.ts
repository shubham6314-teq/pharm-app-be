import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Request, Response } from 'express';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAccessPayload } from './auth.types.js';
import { LoginDto } from './dto/login.dto.js';
import { REFRESH_TOKEN_COOKIE } from './refresh-cookie.js';
import { TokenService } from './token.service.js';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    login: ReturnType<typeof vi.fn>;
    refresh: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
    changePassword: ReturnType<typeof vi.fn>;
    updateProfile: ReturnType<typeof vi.fn>;
    forgotPassword: ReturnType<typeof vi.fn>;
    resetPassword: ReturnType<typeof vi.fn>;
  };
  let response: {
    cookie: ReturnType<typeof vi.fn>;
    clearCookie: ReturnType<typeof vi.fn>;
  };

  const session = {
    user: {
      id: '11111111-1111-1111-1111-111111111111',
      email: 'pharmacist@example.com',
      name: 'Pharmacist',
    },
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    tokenType: 'Bearer' as const,
    expiresIn: 900,
  };

  const publicTokens = {
    user: session.user,
    accessToken: session.accessToken,
    tokenType: session.tokenType,
    expiresIn: session.expiresIn,
  };

  const user: JwtAccessPayload = {
    sub: session.user.id,
    email: session.user.email,
    typ: 'access',
  };

  function createRequest(refreshToken?: string): Request {
    return {
      cookies: refreshToken ? { [REFRESH_TOKEN_COOKIE]: refreshToken } : {},
    } as Request;
  }

  beforeEach(async () => {
    authService = {
      login: vi.fn(),
      refresh: vi.fn(),
      logout: vi.fn(),
      changePassword: vi.fn(),
      updateProfile: vi.fn(),
      forgotPassword: vi.fn(),
      resetPassword: vi.fn(),
    };
    response = {
      cookie: vi.fn(),
      clearCookie: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        {
          provide: TokenService,
          useValue: {
            verifyAccessToken: vi.fn(),
            getRefreshTtlSeconds: vi.fn().mockReturnValue(604800),
          },
        },
      ],
    }).compile();

    controller = module.get(AuthController);
  });

  it('logs in a user and sets the refresh cookie', async () => {
    const dto: LoginDto = {
      email: 'pharmacist@example.com',
      password: 'secret-password',
    };
    authService.login.mockResolvedValue(session);

    await expect(
      controller.login(dto, response as unknown as Response),
    ).resolves.toEqual(publicTokens);
    expect(authService.login).toHaveBeenCalledWith(dto);
    expect(response.cookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE,
      session.refreshToken,
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        path: '/api',
        maxAge: 604800 * 1000,
      }),
    );
  });

  it('refreshes tokens from the refresh cookie', async () => {
    authService.refresh.mockResolvedValue(session);

    await expect(
      controller.refresh(
        createRequest(session.refreshToken),
        response as unknown as Response,
      ),
    ).resolves.toEqual(publicTokens);
    expect(authService.refresh).toHaveBeenCalledWith(session.refreshToken);
    expect(response.cookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE,
      session.refreshToken,
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it('rejects refresh when the cookie is missing', async () => {
    await expect(
      controller.refresh(createRequest(), response as unknown as Response),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authService.refresh).not.toHaveBeenCalled();
  });

  it('logs out a user and clears the refresh cookie', async () => {
    authService.logout.mockResolvedValue(undefined);

    await expect(
      controller.logout(
        createRequest(session.refreshToken),
        response as unknown as Response,
      ),
    ).resolves.toBeUndefined();
    expect(authService.logout).toHaveBeenCalledWith(session.refreshToken);
    expect(response.clearCookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE,
      expect.objectContaining({
        httpOnly: true,
        path: '/api',
      }),
    );
  });

  it('clears the cookie even when logout has no valid refresh token', async () => {
    authService.logout.mockRejectedValue(new UnauthorizedException());

    await expect(
      controller.logout(
        createRequest('bad-token'),
        response as unknown as Response,
      ),
    ).resolves.toBeUndefined();
    expect(response.clearCookie).toHaveBeenCalled();
  });

  it('clears the cookie when logout has no cookie', async () => {
    await expect(
      controller.logout(createRequest(), response as unknown as Response),
    ).resolves.toBeUndefined();
    expect(authService.logout).not.toHaveBeenCalled();
    expect(response.clearCookie).toHaveBeenCalled();
  });

  it('changes the password for the authenticated user and clears the cookie', async () => {
    authService.changePassword.mockResolvedValue(undefined);
    const dto = {
      currentPassword: 'secret-password',
      newPassword: 'new-secret-password',
      confirmPassword: 'new-secret-password',
    };

    await expect(
      controller.changePassword(user, dto, response as unknown as Response),
    ).resolves.toBeUndefined();
    expect(authService.changePassword).toHaveBeenCalledWith(user.sub, dto);
    expect(response.clearCookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE,
      expect.objectContaining({
        httpOnly: true,
        path: '/api',
      }),
    );
  });

  it('updates the profile email and clears the cookie', async () => {
    const result = {
      user: {
        ...session.user,
        email: 'new@example.com',
      },
      emailChanged: true,
    };
    authService.updateProfile.mockResolvedValue(result);
    const dto = {
      name: session.user.name,
      email: 'new@example.com',
    };

    await expect(
      controller.updateProfile(user, dto, response as unknown as Response),
    ).resolves.toEqual(result);
    expect(authService.updateProfile).toHaveBeenCalledWith(user.sub, dto);
    expect(response.clearCookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE,
      expect.objectContaining({
        httpOnly: true,
        path: '/api',
      }),
    );
  });

  it('updates the profile name without clearing the cookie', async () => {
    const result = {
      user: {
        ...session.user,
        name: 'Lead Pharmacist',
      },
      emailChanged: false,
    };
    authService.updateProfile.mockResolvedValue(result);
    const dto = { name: 'Lead Pharmacist', email: session.user.email };

    await expect(
      controller.updateProfile(user, dto, response as unknown as Response),
    ).resolves.toEqual(result);
    expect(authService.updateProfile).toHaveBeenCalledWith(user.sub, dto);
    expect(response.clearCookie).not.toHaveBeenCalled();
  });

  it('requests a password reset', async () => {
    authService.forgotPassword.mockResolvedValue({
      message: 'If an account exists for this email, a reset link has been sent.',
    });

    await expect(
      controller.forgotPassword({ email: user.email }),
    ).resolves.toMatchObject({ message: expect.any(String) });
  });

  it('resets a password', async () => {
    authService.resetPassword.mockResolvedValue(undefined);

    await expect(
      controller.resetPassword({
        token: 'reset-token',
        newPassword: 'new-secret-password',
      }),
    ).resolves.toBeUndefined();
  });
});
