export const BCRYPT_ROUNDS = 12;

export const DEFAULT_ACCESS_TTL_SECONDS = 900;
export const DEFAULT_REFRESH_TTL_SECONDS = 60 * 60 * 24 * 7;
export const PASSWORD_RESET_TTL_SECONDS = 30 * 60;
export const DEFAULT_FRONTEND_RESET_URL = 'http://localhost:3000/reset-password';

export const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password';
export const INVALID_REFRESH_TOKEN_MESSAGE = 'Invalid refresh token';
export const INVALID_CURRENT_PASSWORD_MESSAGE = 'Current password is incorrect';
export const INVALID_RESET_TOKEN_MESSAGE = 'Invalid or expired reset token';
export const PASSWORD_MISMATCH_MESSAGE = 'Passwords do not match';
export const PASSWORD_UNCHANGED_MESSAGE =
  'New password must be different from the current password';
export const EMAIL_IN_USE_MESSAGE = 'An account with this email already exists';
export const PROFILE_UNCHANGED_MESSAGE = 'Name and email are unchanged';
export const FORGOT_PASSWORD_MESSAGE =
  'If an account exists for this email, a reset link has been sent.';
