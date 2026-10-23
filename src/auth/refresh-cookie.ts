import type { CookieOptions, Request } from 'express';

export const REFRESH_TOKEN_COOKIE = 'refreshToken';
export const REFRESH_TOKEN_COOKIE_PATH = '/api';

export function getRefreshCookieOptions(maxAgeSeconds: number): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: REFRESH_TOKEN_COOKIE_PATH,
    maxAge: maxAgeSeconds * 1000,
  };
}

export function getRefreshCookieClearOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: REFRESH_TOKEN_COOKIE_PATH,
  };
}

export function readRefreshCookie(request: Request): string | undefined {
  const value = request.cookies?.[REFRESH_TOKEN_COOKIE];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
