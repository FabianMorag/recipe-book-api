import { Injectable } from '@nestjs/common'
import type { Request } from 'express'
import { PrismaService } from '../prisma/prisma.service'
import {
  loadAuthRuntime,
  type AuthRuntime,
  type ExpressAuthConfig,
  type Session,
} from './auth-loader'

/**
 * Auth.js `session` callback for the database session strategy.
 *
 * Auth.js passes the user record (from the Prisma adapter) as the second
 * argument. The default `Session['user']` only promises `name`/`email`/`image`;
 * we forward the user `id` so `GET /me` can return
 * `{ id, name, email, image }` as documented in the README.
 *
 * Exported as a pure function so it can be unit-tested without booting the
 * Auth.js runtime or a live database.
 */
export function mapSessionUserId({
  session,
  user,
}: {
  session: Session
  user?: { id?: string | null } | null
}): Session {
  if (user?.id) {
    session.user.id = user.id
  }
  return session
}

/**
 * Owns the Auth.js runtime for the rest of the application.
 *
 * Because the Auth.js packages are ESM-only and this project is CommonJS, the
 * runtime is loaded asynchronously via {@link loadAuthRuntime} and the resolved
 * config is cached here. {@link AuthService.init} must run during bootstrap
 * (before any request) so that the Express handler and `getSession` are ready.
 */
@Injectable()
export class AuthService {
  private runtime: AuthRuntime | null = null
  private config: ExpressAuthConfig | null = null

  constructor(private readonly prisma: PrismaService) {}

  async init(): Promise<void> {
    const runtime = await loadAuthRuntime()
    this.runtime = runtime
    this.config = {
      // The Express handler is mounted at /auth (see AuthBootstrap), so the
      // base path used to build action/callback URLs must match.
      basePath: '/auth',
      providers: [runtime.Google],
      adapter: runtime.PrismaAdapter(this.prisma),
      session: { strategy: 'database' },
      // Trust the Host header so Auth.js can build correct absolute URLs and
      // detect HTTPS behind a reverse proxy. Pair with `trust proxy` on
      // Express. Env-controlled so local/dev can opt out.
      trustHost: process.env['AUTH_TRUST_HOST'] === 'true',
      callbacks: {
        session: mapSessionUserId,
      },
    }
  }

  /** The Express middleware returned by `ExpressAuth(config)`. */
  get expressHandler(): import('express').RequestHandler {
    this.ensureReady()
    return this.runtime!.ExpressAuth(this.config!)
  }

  /** Resolves the current session for an Express request, or null. */
  async getSession(req: Request): Promise<Session | null> {
    this.ensureReady()
    return (await this.runtime!.getSession(req, this.config!)) as Session | null
  }

  private ensureReady(): void {
    if (!this.runtime || !this.config) {
      throw new Error('AuthService is not initialized. Call init() first.')
    }
  }
}
