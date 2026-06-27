import { Module } from '@nestjs/common'
import { AuthBootstrap } from './auth.bootstrap'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'

/**
 * Wires up backend-owned Google OAuth via Auth.js.
 *
 * Exposes the Auth.js REST surface at `/auth/*` (mounted by {@link AuthBootstrap}
 * on the Express instance) and a NestJS `GET /me` controller backed by
 * {@link AuthService}. `PrismaService` is provided globally by `PrismaModule`.
 */
@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthBootstrap],
  exports: [AuthService],
})
export class AuthModule {}
