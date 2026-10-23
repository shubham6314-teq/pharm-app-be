import {
  DEFAULT_FRONTEND_ORIGIN,
  parseFrontendOrigins,
} from './app.setup.js';

describe('parseFrontendOrigins', () => {
  it('defaults to the Vite origin', () => {
    expect(parseFrontendOrigins(undefined)).toEqual([DEFAULT_FRONTEND_ORIGIN]);
    expect(parseFrontendOrigins('')).toEqual([DEFAULT_FRONTEND_ORIGIN]);
  });

  it('parses a comma-separated allowlist', () => {
    expect(
      parseFrontendOrigins('http://localhost:5173, https://app.example.com'),
    ).toEqual(['http://localhost:5173', 'https://app.example.com']);
  });
});
