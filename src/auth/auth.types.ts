export type JwtAccessPayload = {
  sub: string;
  email: string;
  typ: 'access';
};

export type JwtRefreshPayload = {
  sub: string;
  email: string;
  jti: string;
  typ: 'refresh';
};

export type PublicUser = {
  id: string;
  email: string;
  name: string;
};

export type UpdateProfileResult = {
  user: PublicUser;
  emailChanged: boolean;
};

export type AuthTokensResponse = {
  user: PublicUser;
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
};

export type AuthSession = AuthTokensResponse & {
  refreshToken: string;
};
