import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, timingSafeEqual } from 'node:crypto';
import {
  DEFAULT_ACCESS_TTL_SECONDS,
  DEFAULT_REFRESH_TTL_SECONDS,
} from './auth.constants.js';
import { JwtAccessPayload, JwtRefreshPayload } from './auth.types.js';

@Injectable()
export class TokenService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessTtlSeconds: number;
  private readonly refreshTtlSeconds: number;

  constructor(
    private readonly jwtService: JwtService,
    configService: ConfigService,
  ) {
    this.accessSecret = configService.getOrThrow<string>('JWT_ACCESS_SECRET');
    this.refreshSecret = configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    this.accessTtlSeconds = this.readTtlSeconds(
      configService.get<string>('JWT_ACCESS_TTL_SECONDS'),
      DEFAULT_ACCESS_TTL_SECONDS,
    );
    this.refreshTtlSeconds = this.readTtlSeconds(
      configService.get<string>('JWT_REFRESH_TTL_SECONDS'),
      DEFAULT_REFRESH_TTL_SECONDS,
    );
  }

  getAccessTtlSeconds(): number {
    return this.accessTtlSeconds;
  }

  getRefreshTtlSeconds(): number {
    return this.refreshTtlSeconds;
  }

  signAccessToken(payload: Omit<JwtAccessPayload, 'typ'>): Promise<string> {
    return this.jwtService.signAsync(
      { ...payload, typ: 'access' },
      {
        secret: this.accessSecret,
        expiresIn: this.accessTtlSeconds,
      },
    );
  }

  signRefreshToken(payload: Omit<JwtRefreshPayload, 'typ'>): Promise<string> {
    return this.jwtService.signAsync(
      { ...payload, typ: 'refresh' },
      {
        secret: this.refreshSecret,
        expiresIn: this.refreshTtlSeconds,
      },
    );
  }

  async verifyAccessToken(token: string): Promise<JwtAccessPayload> {
    const payload = await this.jwtService.verifyAsync<JwtAccessPayload>(token, {
      secret: this.accessSecret,
    });

    if (payload.typ !== 'access' || !payload.sub || !payload.email) {
      throw new Error('Invalid access token payload');
    }

    return payload;
  }

  async verifyRefreshToken(token: string): Promise<JwtRefreshPayload> {
    const payload = await this.jwtService.verifyAsync<JwtRefreshPayload>(
      token,
      {
        secret: this.refreshSecret,
      },
    );

    if (
      payload.typ !== 'refresh' ||
      !payload.sub ||
      !payload.email ||
      !payload.jti
    ) {
      throw new Error('Invalid refresh token payload');
    }

    return payload;
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  areHashesEqual(storedHash: string, incomingHash: string): boolean {
    const stored = Buffer.from(storedHash);
    const incoming = Buffer.from(incomingHash);

    if (stored.length !== incoming.length) {
      return false;
    }

    return timingSafeEqual(stored, incoming);
  }

  private readTtlSeconds(value: string | undefined, fallback: number): number {
    if (value === undefined || value === '') {
      return fallback;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
