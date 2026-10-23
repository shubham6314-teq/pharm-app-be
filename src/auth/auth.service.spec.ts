import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { AuthService } from './auth.service.js';
import {
  EMAIL_IN_USE_MESSAGE,
  FORGOT_PASSWORD_MESSAGE,
  PROFILE_UNCHANGED_MESSAGE,
  INVALID_CREDENTIALS_MESSAGE,
  INVALID_CURRENT_PASSWORD_MESSAGE,
  INVALID_REFRESH_TOKEN_MESSAGE,
  INVALID_RESET_TOKEN_MESSAGE,
  PASSWORD_UNCHANGED_MESSAGE,
} from './auth.constants.js';
import { PasswordService } from './password.service.js';
import { TokenService } from './token.service.js';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    refreshToken: {
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
    passwordResetToken: {
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let passwordService: {
    hash: ReturnType<typeof vi.fn>;
    compare: ReturnType<typeof vi.fn>;
  };
  let tokenService: {
    signAccessToken: ReturnType<typeof vi.fn>;
    signRefreshToken: ReturnType<typeof vi.fn>;
    verifyRefreshToken: ReturnType<typeof vi.fn>;
    hashToken: ReturnType<typeof vi.fn>;
    areHashesEqual: ReturnType<typeof vi.fn>;
    getAccessTtlSeconds: ReturnType<typeof vi.fn>;
    getRefreshTtlSeconds: ReturnType<typeof vi.fn>;
  };
  let mailService: {
    sendPasswordReset: ReturnType<typeof vi.fn>;
  };

  const user = {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'pharmacist@example.com',
    name: 'Pharmacist',
    passwordHash: 'hashed-password',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      refreshToken: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      passwordResetToken: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      $transaction: vi.fn().mockResolvedValue([]),
    };
    passwordService = {
      hash: vi.fn(),
      compare: vi.fn(),
    };
    tokenService = {
      signAccessToken: vi.fn().mockResolvedValue('access-token'),
      signRefreshToken: vi.fn().mockResolvedValue('refresh-token'),
      verifyRefreshToken: vi.fn(),
      hashToken: vi.fn().mockReturnValue('token-hash'),
      areHashesEqual: vi.fn().mockReturnValue(true),
      getAccessTtlSeconds: vi.fn().mockReturnValue(900),
      getRefreshTtlSeconds: vi.fn().mockReturnValue(604800),
    };
    mailService = {
      sendPasswordReset: vi.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: PasswordService, useValue: passwordService },
        { provide: TokenService, useValue: tokenService },
        { provide: MailService, useValue: mailService },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key === 'FRONTEND_RESET_URL'
                ? 'http://frontend.test/reset-password'
                : undefined,
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('logs in with a valid email and password', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    passwordService.compare.mockResolvedValue(true);
    prisma.refreshToken.create.mockResolvedValue({});

    await expect(
      service.login({
        email: user.email,
        password: 'secret-password',
      }),
    ).resolves.toMatchObject({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      tokenType: 'Bearer',
    });
    expect(passwordService.compare).toHaveBeenCalledWith(
      'secret-password',
      user.passwordHash,
    );
  });

  it('returns 401 for an unknown email', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.login({
        email: user.email,
        password: 'secret-password',
      }),
    ).rejects.toMatchObject({
      message: INVALID_CREDENTIALS_MESSAGE,
    });
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('returns 401 for a wrong password', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    passwordService.compare.mockResolvedValue(false);

    await expect(
      service.login({
        email: user.email,
        password: 'wrong-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rotates refresh tokens', async () => {
    tokenService.verifyRefreshToken.mockResolvedValue({
      sub: user.id,
      email: user.email,
      jti: 'refresh-id',
      typ: 'refresh',
    });
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'refresh-id',
      userId: user.id,
      tokenHash: 'token-hash',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
    });
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.refreshToken.update.mockResolvedValue({});
    prisma.refreshToken.create.mockResolvedValue({});

    await expect(service.refresh('refresh-token')).resolves.toMatchObject({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    expect(prisma.refreshToken.update).toHaveBeenCalledWith({
      where: { id: 'refresh-id' },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('returns 401 for a revoked refresh token', async () => {
    tokenService.verifyRefreshToken.mockResolvedValue({
      sub: user.id,
      email: user.email,
      jti: 'refresh-id',
      typ: 'refresh',
    });
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'refresh-id',
      userId: user.id,
      tokenHash: 'token-hash',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: new Date(),
    });

    await expect(service.refresh('refresh-token')).rejects.toMatchObject({
      message: INVALID_REFRESH_TOKEN_MESSAGE,
    });
  });

  it('changes password and revokes refresh tokens', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    passwordService.compare.mockResolvedValue(true);
    passwordService.hash.mockResolvedValue('new-hash');

    await expect(
      service.changePassword(user.id, {
        currentPassword: 'secret-password',
        newPassword: 'new-secret-password',
        confirmPassword: 'new-secret-password',
      }),
    ).resolves.toBeUndefined();
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('rejects change password when the current password is wrong', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    passwordService.compare.mockResolvedValue(false);

    await expect(
      service.changePassword(user.id, {
        currentPassword: 'wrong-password',
        newPassword: 'new-secret-password',
        confirmPassword: 'new-secret-password',
      }),
    ).rejects.toMatchObject({
      message: INVALID_CURRENT_PASSWORD_MESSAGE,
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects change password when the new password is unchanged', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    passwordService.compare.mockResolvedValue(true);

    await expect(
      service.changePassword(user.id, {
        currentPassword: 'secret-password',
        newPassword: 'secret-password',
        confirmPassword: 'secret-password',
      }),
    ).rejects.toMatchObject({
      message: PASSWORD_UNCHANGED_MESSAGE,
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('updates email and revokes refresh tokens without sending mail', async () => {
    const updatedUser = {
      ...user,
      email: 'new@example.com',
    };
    prisma.user.findUnique
      .mockResolvedValueOnce(user)
      .mockResolvedValueOnce(null);
    prisma.$transaction.mockResolvedValue([updatedUser]);

    await expect(
      service.updateProfile(user.id, {
        name: user.name,
        email: 'new@example.com',
      }),
    ).resolves.toEqual({
      user: {
        id: user.id,
        email: 'new@example.com',
        name: user.name,
      },
      emailChanged: true,
    });
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(mailService.sendPasswordReset).not.toHaveBeenCalled();
  });

  it('rejects profile update when name and email are unchanged', async () => {
    prisma.user.findUnique.mockResolvedValue(user);

    await expect(
      service.updateProfile(user.id, {
        name: user.name,
        email: user.email,
      }),
    ).rejects.toMatchObject({
      message: PROFILE_UNCHANGED_MESSAGE,
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects profile email update when the address is already in use', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(user)
      .mockResolvedValueOnce({
        ...user,
        id: '22222222-2222-2222-2222-222222222222',
        email: 'taken@example.com',
      });

    await expect(
      service.updateProfile(user.id, {
        name: user.name,
        email: 'taken@example.com',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns 409 when profile email update hits a unique constraint', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(user)
      .mockResolvedValueOnce(null);
    prisma.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['email'] },
      }),
    );

    await expect(
      service.updateProfile(user.id, {
        name: user.name,
        email: 'new@example.com',
      }),
    ).rejects.toMatchObject({
      message: EMAIL_IN_USE_MESSAGE,
    });
  });

  it('updates name and email together and revokes refresh tokens', async () => {
    const updatedUser = {
      ...user,
      name: 'Lead Pharmacist',
      email: 'new@example.com',
    };
    prisma.user.findUnique
      .mockResolvedValueOnce(user)
      .mockResolvedValueOnce(null);
    prisma.$transaction.mockResolvedValue([updatedUser]);

    await expect(
      service.updateProfile(user.id, {
        name: 'Lead Pharmacist',
        email: 'new@example.com',
      }),
    ).resolves.toEqual({
      user: {
        id: user.id,
        email: 'new@example.com',
        name: 'Lead Pharmacist',
      },
      emailChanged: true,
    });
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('updates the user name without revoking refresh tokens', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.user.update.mockResolvedValue({
      ...user,
      name: 'Lead Pharmacist',
    });

    await expect(
      service.updateProfile(user.id, {
        name: 'Lead Pharmacist',
        email: user.email,
      }),
    ).resolves.toEqual({
      user: {
        id: user.id,
        email: user.email,
        name: 'Lead Pharmacist',
      },
      emailChanged: false,
    });
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('sends a reset email when the user exists', async () => {
    prisma.user.findUnique.mockResolvedValue(user);

    await expect(
      service.forgotPassword({ email: user.email }),
    ).resolves.toEqual({ message: FORGOT_PASSWORD_MESSAGE });
    expect(mailService.sendPasswordReset).toHaveBeenCalledWith(
      user.email,
      expect.stringContaining('http://frontend.test/reset-password?token='),
    );
  });

  it('does not send email when the user does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.forgotPassword({ email: user.email }),
    ).resolves.toEqual({ message: FORGOT_PASSWORD_MESSAGE });
    expect(mailService.sendPasswordReset).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('resets a password with a valid unused token', async () => {
    prisma.passwordResetToken.findUnique.mockResolvedValue({
      id: 'reset-id',
      userId: user.id,
      tokenHash: 'token-hash',
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    });
    passwordService.hash.mockResolvedValue('new-hash');

    await expect(
      service.resetPassword({
        token: 'raw-token',
        newPassword: 'new-secret-password',
      }),
    ).resolves.toBeUndefined();
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('rejects an expired or used reset token', async () => {
    prisma.passwordResetToken.findUnique.mockResolvedValue({
      id: 'reset-id',
      userId: user.id,
      tokenHash: 'token-hash',
      expiresAt: new Date(Date.now() - 1000),
      usedAt: null,
    });

    await expect(
      service.resetPassword({
        token: 'raw-token',
        newPassword: 'new-secret-password',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.passwordResetToken.findUnique.mockResolvedValue({
      id: 'reset-id',
      userId: user.id,
      tokenHash: 'token-hash',
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: new Date(),
    });

    await expect(
      service.resetPassword({
        token: 'raw-token',
        newPassword: 'new-secret-password',
      }),
    ).rejects.toMatchObject({
      message: INVALID_RESET_TOKEN_MESSAGE,
    });
  });
});
