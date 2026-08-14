import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AUTH_REPOSITORY } from './domain/auth.repository';
import { LOGIN_RATE_LIMITER } from './domain/login-rate-limiter';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtStrategy } from './guards/jwt.strategy';
import { LoginRateLimitGuard } from './guards/login-rate-limit.guard';
import { RolesGuard } from './guards/roles.guard';
import { PrismaAuthRepository } from './infrastructure/prisma-auth.repository';
import { RedisLoginRateLimiter } from './infrastructure/redis-login-rate-limiter';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' }), JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtAuthGuard,
    LoginRateLimitGuard,
    RolesGuard,
    PrismaAuthRepository,
    RedisLoginRateLimiter,
    {
      provide: AUTH_REPOSITORY,
      useExisting: PrismaAuthRepository,
    },
    {
      provide: LOGIN_RATE_LIMITER,
      useExisting: RedisLoginRateLimiter,
    },
  ],
  exports: [JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
