import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { JwtAccessPayload } from '../auth.types.js';
import type { RequestWithUser } from '../guards/jwt-auth.guard.js';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): JwtAccessPayload => {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    return request.user;
  },
);
