import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { LOGIN_RATE_LIMITER, type LoginRateLimiter } from '../domain/login-rate-limiter';

@Injectable()
export class LoginRateLimitGuard implements CanActivate {
  constructor(
    @Inject(LOGIN_RATE_LIMITER)
    private readonly limiter: LoginRateLimiter,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const result = await this.limiter.consume(this.clientIdentity(request));
    if (!result.allowed) {
      response.setHeader('Retry-After', String(result.retryAfterSeconds));
      throw new HttpException('Too many login attempts', HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }

  private clientIdentity(request: Request): string {
    const ip = request.ip ?? request.socket.remoteAddress;
    return ip && ip.length > 0 ? ip : 'unknown';
  }
}
