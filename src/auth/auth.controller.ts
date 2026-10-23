import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import type {
  AuthSession,
  AuthTokensResponse,
  JwtAccessPayload,
  UpdateProfileResult,
} from './auth.types.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { Public } from './decorators/public.decorator.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import {
  getRefreshCookieClearOptions,
  getRefreshCookieOptions,
  readRefreshCookie,
  REFRESH_TOKEN_COOKIE,
} from './refresh-cookie.js';
import { TokenService } from './token.service.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthTokensResponse> {
    const session = await this.authService.login(loginDto);
    this.attachRefreshCookie(response, session.refreshToken);
    return this.toPublicAuthResponse(session);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthTokensResponse> {
    const refreshToken = readRefreshCookie(request);
    if (!refreshToken) {
      throw new UnauthorizedException();
    }

    const session = await this.authService.refresh(refreshToken);
    this.attachRefreshCookie(response, session.refreshToken);
    return this.toPublicAuthResponse(session);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const refreshToken = readRefreshCookie(request);
    if (refreshToken) {
      try {
        await this.authService.logout(refreshToken);
      } catch {
        // Always clear the cookie so the UI can finish signing out.
      }
    }

    this.clearRefreshCookie(response);
  }

  @Patch('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @CurrentUser() user: JwtAccessPayload,
    @Body() changePasswordDto: ChangePasswordDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.authService.changePassword(user.sub, changePasswordDto);
    this.clearRefreshCookie(response);
  }

  @Patch('profile')
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @CurrentUser() user: JwtAccessPayload,
    @Body() updateProfileDto: UpdateProfileDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<UpdateProfileResult> {
    const result = await this.authService.updateProfile(
      user.sub,
      updateProfileDto,
    );

    if (result.emailChanged) {
      this.clearRefreshCookie(response);
    }

    return result;
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  private attachRefreshCookie(response: Response, refreshToken: string) {
    response.cookie(
      REFRESH_TOKEN_COOKIE,
      refreshToken,
      getRefreshCookieOptions(this.tokenService.getRefreshTtlSeconds()),
    );
  }

  private clearRefreshCookie(response: Response) {
    response.clearCookie(REFRESH_TOKEN_COOKIE, getRefreshCookieClearOptions());
  }

  private toPublicAuthResponse(session: AuthSession): AuthTokensResponse {
    return {
      user: session.user,
      accessToken: session.accessToken,
      tokenType: session.tokenType,
      expiresIn: session.expiresIn,
    };
  }
}
