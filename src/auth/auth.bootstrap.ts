import { Injectable, OnModuleInit } from '@nestjs/common'
import { HttpAdapterHost } from '@nestjs/core'
import type { Express } from 'express'
import { AuthService } from './auth.service'

/**
 * Mounts the Auth.js Express handler on the underlying Express application
 * during NestJS bootstrap.
 *
 * The handler is mounted at `/auth` (a prefix mount), which is valid in both
 * Express 4 and 5. Express 5 rejects the `app.use('/auth/*', ...)` pattern from
 * the Auth.js docs because path-to-regexp v8 requires named wildcards. With a
 * prefix mount Express strips `/auth` into `req.baseUrl` and Auth.js derives
 * `basePath = '/auth'` from it, so the Google callback URL resolves to
 * `${origin}/auth/callback/google` as expected.
 */
@Injectable()
export class AuthBootstrap implements OnModuleInit {
  constructor(
    private readonly authService: AuthService,
    private readonly adapterHost: HttpAdapterHost,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.authService.init()
    const express = this.adapterHost.httpAdapter.getInstance<Express>()
    // Trust proxy headers so Auth.js detects HTTPS when served behind a reverse
    // proxy. Env-controlled to stay aligned with Auth.js `trustHost` (also
    // gated on AUTH_TRUST_HOST === 'true'); keeping it off in local dev avoids
    // trusting spoofed X-Forwarded-* headers. Pair with the `trustHost` flag
    // configured in AuthService.
    if (process.env['AUTH_TRUST_HOST'] === 'true') {
      express.set('trust proxy', true)
    }
    express.use('/auth', this.authService.expressHandler)
  }
}
