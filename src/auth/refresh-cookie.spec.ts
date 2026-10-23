import {
  getRefreshCookieClearOptions,
  getRefreshCookieOptions,
  readRefreshCookie,
  REFRESH_TOKEN_COOKIE,
} from './refresh-cookie.js';

describe('refresh cookie', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('sets HttpOnly Lax cookies with a millisecond max-age', () => {
    process.env.NODE_ENV = 'development';

    expect(getRefreshCookieOptions(604800)).toEqual({
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/api',
      maxAge: 604800 * 1000,
    });
  });

  it('sets Secure in production', () => {
    process.env.NODE_ENV = 'production';

    expect(getRefreshCookieOptions(60).secure).toBe(true);
    expect(getRefreshCookieClearOptions().secure).toBe(true);
  });

  it('reads a present refresh cookie', () => {
    expect(
      readRefreshCookie({
        cookies: { [REFRESH_TOKEN_COOKIE]: 'refresh-token' },
      } as never),
    ).toBe('refresh-token');
  });

  it('ignores a missing or empty refresh cookie', () => {
    expect(readRefreshCookie({ cookies: {} } as never)).toBeUndefined();
    expect(
      readRefreshCookie({
        cookies: { [REFRESH_TOKEN_COOKIE]: '' },
      } as never),
    ).toBeUndefined();
  });
});
