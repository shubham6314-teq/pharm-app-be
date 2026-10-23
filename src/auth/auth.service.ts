import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, randomUUID } from 'node:crypto';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import {
  DEFAULT_FRONTEND_RESET_URL,
  EMAIL_IN_USE_MESSAGE,
  FORGOT_PASSWORD_MESSAGE,
  PROFILE_UNCHANGED_MESSAGE,
  INVALID_CREDENTIALS_MESSAGE,
  INVALID_CURRENT_PASSWORD_MESSAGE,
  INVALID_REFRESH_TOKEN_MESSAGE,
  INVALID_RESET_TOKEN_MESSAGE,
  PASSWORD_RESET_TTL_SECONDS,
  PASSWORD_UNCHANGED_MESSAGE,
} from './auth.constants.js';
import { AuthSession, PublicUser, UpdateProfileResult } from './auth.types.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { PasswordService } from './password.service.js';
import { TokenService } from './token.service.js';

type AuthUser = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  async login(loginDto: LoginDto): Promise<AuthSession> {
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
    });

    const passwordMatches = user
      ? await this.passwordService.compare(loginDto.password, user.passwordHash)
      : false;

    if (!user || !passwordMatches) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    return this.issueAuthSession(user);
  }

  async refresh(refreshToken: string): Promise<AuthSession> {
    const payload = await this.verifyRefreshPayload(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { id: payload.jti },
    });

    this.assertStoredRefreshToken(stored, payload.sub, refreshToken);

    const user = await this.prisma.user.findUnique({
      where: { id: stored.userId },
    });

    if (!user) {
      throw new UnauthorizedException(INVALID_REFRESH_TOKEN_MESSAGE);
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueAuthSession(user);
  }

  async logout(refreshToken: string): Promise<void> {
    const payload = await this.verifyRefreshPayload(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { id: payload.jti },
    });

    if (
      !stored ||
      stored.userId !== payload.sub ||
      !this.tokenService.areHashesEqual(
        stored.tokenHash,
        this.tokenService.hashToken(refreshToken),
      )
    ) {
      throw new UnauthorizedException(INVALID_REFRESH_TOKEN_MESSAGE);
    }

    if (stored.revokedAt) {
      return;
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
  }

  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    const matches = await this.passwordService.compare(
      changePasswordDto.currentPassword,
      user.passwordHash,
    );

    if (!matches) {
      throw new UnauthorizedException(INVALID_CURRENT_PASSWORD_MESSAGE);
    }

    if (changePasswordDto.newPassword === changePasswordDto.currentPassword) {
      throw new BadRequestException(PASSWORD_UNCHANGED_MESSAGE);
    }

    const passwordHash = await this.passwordService.hash(
      changePasswordDto.newPassword,
    );

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      this.revokeUserRefreshTokens(user.id),
    ]);
  }

  async updateProfile(
    userId: string,
    updateProfileDto: UpdateProfileDto,
  ): Promise<UpdateProfileResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    const nameChanged = updateProfileDto.name !== user.name;
    const emailChanged = updateProfileDto.email !== user.email;

    if (!nameChanged && !emailChanged) {
      throw new BadRequestException(PROFILE_UNCHANGED_MESSAGE);
    }

    if (!emailChanged) {
      const updated = await this.prisma.user.update({
        where: { id: user.id },
        data: { name: updateProfileDto.name },
      });

      return {
        user: this.toPublicUser(updated),
        emailChanged: false,
      };
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: updateProfileDto.email },
    });

    if (existing) {
      throw new ConflictException(EMAIL_IN_USE_MESSAGE);
    }

    try {
      const [updated] = await this.prisma.$transaction([
        this.prisma.user.update({
          where: { id: user.id },
          data: {
            name: updateProfileDto.name,
            email: updateProfileDto.email,
          },
        }),
        this.revokeUserRefreshTokens(user.id),
      ]);

      return {
        user: this.toPublicUser(updated),
        emailChanged: true,
      };
    } catch (error) {
      this.handleUniqueEmailError(error);
      throw error;
    }
  }

  async forgotPassword(
    forgotPasswordDto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: forgotPasswordDto.email },
    });

    if (!user) {
      return { message: FORGOT_PASSWORD_MESSAGE };
    }

    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = this.tokenService.hashToken(rawToken);

    await this.prisma.$transaction([
      this.prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_SECONDS * 1000),
        },
      }),
    ]);

    await this.mailService.sendPasswordReset(
      user.email,
      this.buildResetUrl(rawToken),
    );

    return { message: FORGOT_PASSWORD_MESSAGE };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<void> {
    const tokenHash = this.tokenService.hashToken(resetPasswordDto.token);
    const stored = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!stored || stored.usedAt || stored.expiresAt <= new Date()) {
      throw new BadRequestException(INVALID_RESET_TOKEN_MESSAGE);
    }

    const passwordHash = await this.passwordService.hash(
      resetPasswordDto.newPassword,
    );

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: stored.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: stored.id },
        data: { usedAt: new Date() },
      }),
      this.revokeUserRefreshTokens(stored.userId),
    ]);
  }

  private revokeUserRefreshTokens(userId: string) {
    return this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private handleUniqueEmailError(error: unknown): void {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== 'P2002'
    ) {
      return;
    }

    throw new ConflictException(EMAIL_IN_USE_MESSAGE);
  }

  private async issueAuthSession(user: AuthUser): Promise<AuthSession> {
    const refreshTokenId = randomUUID();
    const refreshToken = await this.tokenService.signRefreshToken({
      sub: user.id,
      email: user.email,
      jti: refreshTokenId,
    });

    await this.prisma.refreshToken.create({
      data: {
        id: refreshTokenId,
        userId: user.id,
        tokenHash: this.tokenService.hashToken(refreshToken),
        expiresAt: new Date(
          Date.now() + this.tokenService.getRefreshTtlSeconds() * 1000,
        ),
      },
    });

    const accessToken = await this.tokenService.signAccessToken({
      sub: user.id,
      email: user.email,
    });

    return {
      user: this.toPublicUser(user),
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.tokenService.getAccessTtlSeconds(),
    };
  }

  private toPublicUser(user: {
    id: string;
    email: string;
    name: string;
  }): PublicUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
    };
  }

  private async verifyRefreshPayload(refreshToken: string) {
    try {
      return await this.tokenService.verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedException(INVALID_REFRESH_TOKEN_MESSAGE);
    }
  }

  private assertStoredRefreshToken(
    stored: {
      id: string;
      userId: string;
      tokenHash: string;
      expiresAt: Date;
      revokedAt: Date | null;
    } | null,
    userId: string,
    refreshToken: string,
  ): asserts stored is {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    revokedAt: Date | null;
  } {
    if (
      !stored ||
      stored.userId !== userId ||
      stored.revokedAt ||
      stored.expiresAt <= new Date() ||
      !this.tokenService.areHashesEqual(
        stored.tokenHash,
        this.tokenService.hashToken(refreshToken),
      )
    ) {
      throw new UnauthorizedException(INVALID_REFRESH_TOKEN_MESSAGE);
    }
  }

  private buildResetUrl(token: string): string {
    const base =
      this.configService.get<string>('FRONTEND_RESET_URL') ??
      DEFAULT_FRONTEND_RESET_URL;
    const url = new URL(base);
    url.searchParams.set('token', token);
    return url.toString();
  }
}
