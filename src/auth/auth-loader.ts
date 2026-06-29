// `@auth/express` and `@auth/prisma-adapter` are ESM-only packages, while this
// project compiles to CommonJS (package.json has no `"type": "module"`). A
// static `import` would be rewritten to `require()` by tsc and fail at runtime
// with `ERR_REQUIRE_ESM`.
//
// Strategy:
// - Type-only imports below are erased at compile time and emit no `require()`.
// - Runtime values are loaded with dynamic `import()`, which Node supports when
//   importing ESM from a CommonJS context.

import type {
  ExpressAuthConfig,
  Session as AuthExpressSession,
} from '@auth/express' with { 'resolution-mode': 'import' }
import type { Request, RequestHandler } from 'express'

export interface AuthRuntime {
  ExpressAuth: (config: ExpressAuthConfig) => RequestHandler
  getSession: (
    req: Request,
    config: ExpressAuthConfig,
  ) => Promise<AuthExpressSession | null>
  PrismaAdapter: (prisma: unknown) => ExpressAuthConfig['adapter']
  Google: NonNullable<ExpressAuthConfig['providers']>[number]
}

export type Session = Omit<AuthExpressSession, 'user'> & {
  user: NonNullable<AuthExpressSession['user']> & { id: string }
}

export type { ExpressAuthConfig }

let runtimePromise: Promise<AuthRuntime> | null = null

/**
 * Lazily loads the Auth.js ESM runtime exactly once and caches the result.
 */
export function loadAuthRuntime(): Promise<AuthRuntime> {
  if (!runtimePromise) {
    runtimePromise = Promise.all([
      import('@auth/express'),
      import('@auth/prisma-adapter'),
      import('@auth/express/providers/google'),
    ]).then(([express, adapter, google]) => ({
      ExpressAuth: express.ExpressAuth,
      getSession: express.getSession,
      PrismaAdapter: adapter.PrismaAdapter,
      Google: google.default,
    }))
  }
  return runtimePromise
}
