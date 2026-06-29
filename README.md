<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ pnpm install
```

`pnpm install` runs `postinstall: prisma generate` automatically, which
regenerates the Prisma client into `src/generated/prisma` (gitignored). You can
also run it explicitly:

```bash
$ pnpm run db:generate
```

### Database scripts

```bash
# Apply pending migrations in local development.
$ pnpm run db:migrate

# Apply existing migrations in production/CI.
$ pnpm run db:deploy

# Reset the local database and re-run migrations. Destructive.
$ pnpm run db:reset

# Open Prisma Studio.
$ pnpm run db:studio
```

`db:generate` only updates the TypeScript Prisma client. It does not change the
database schema. Run `db:migrate` after pulling or creating migrations locally.

## Compile and run the project

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Run tests

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov

# CI (fails on focused tests — guards against `it.only`/`describe.only`/`fit`/`fdescribe`)
$ pnpm run test:ci
$ pnpm run test:e2e:ci
```

The `:ci` scripts run `scripts/forbid-focused-tests.cjs` before Jest. Jest 30
removed the historical `forbidOnly` config option, so the guard is a small
scanner that rejects `it.only`/`test.only`/`describe.only` and the Jest aliases
`fit(`/`fdescribe(` in spec files. The `fit`/`fdescribe` check matches whole
words followed by a call, so ordinary words like `profit` or `outfit` do not
trigger false positives. The regular `test`/`test:e2e`/`test:watch` scripts
skip the guard so local debugging with `.only` keeps working. The scanner has a
standalone verification suite run with `node --test
scripts/forbid-focused-tests.test.cjs`.

## Authentication

This API uses backend-owned [Auth.js](https://authjs.dev) (Express integration)
with Google OAuth and a Prisma-backed database session store. A separate
frontend can redirect the browser to the backend auth routes and read the
resulting session cookie via `GET /me`.

### Auth routes (mounted on Express at `/auth`)

| Route | Purpose |
|-------|---------|
| `GET /auth/signin` | Shows the Auth.js sign-in page with the Google button. |
| `POST /auth/signin/google` | Starts the Google sign-in flow after the sign-in form submits with CSRF protection. |
| `GET /auth/callback/google` | OAuth callback; creates the session and sets the cookie. |
| `GET /auth/signout` | Signs the user out and clears the session. |
| `GET /auth/session` | Returns the current session as JSON. |

### Authenticated identity

`GET /me` returns `{ user: { id, name, email, image } }` when a valid session
cookie is present, or `401` otherwise.

## Frontend API contract

Swagger UI is available at `GET /docs`. The OpenAPI JSON document is available
at `GET /docs-json` and is intended for frontend type and client generation.

Example frontend setup:

```bash
$ pnpm add openapi-fetch
$ pnpm add -D openapi-typescript
$ pnpm exec openapi-typescript http://localhost:3000/docs-json -o src/api/schema.ts
```

Example typed client:

```ts
import createClient from 'openapi-fetch'
import type { paths } from './schema'

export const api = createClient<paths>({
  baseUrl: 'http://localhost:3000',
  credentials: 'include',
})
```

Use `credentials: 'include'` when calling authenticated endpoints so the browser
sends the Auth.js session cookie. Start browser login through the backend-owned
Auth.js route at `/auth/signin`; after login, call `GET /me` to read the current
session user.

### Required environment variables

Copy `.env.example` to `.env` and fill in:

- `DATABASE_URL` — PostgreSQL connection string.
- `AUTH_SECRET` — session/cookie signing secret (`openssl rand -base64 32`).
- `AUTH_TRUST_HOST` — set to `"true"` to trust the Host header behind a proxy.
  Read as a boolean; unset or any other value disables it for local dev.
- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` — Google OAuth client credentials.

### Optional environment variables

- `FRONTEND_ORIGIN` — when set, enables CORS for that origin with credentials
  so a cross-domain frontend can call `/me` and read the session cookie. Leave
  unset for same-origin deployments.
- `PORT` — HTTP port (defaults to `3000`).

### Google Cloud Console redirect URI

```
http://localhost:3000/auth/callback/google     # local dev
https://<your-domain>/auth/callback/google     # production
```

### Notes

- The Auth.js handler is mounted with `app.use('/auth', ...)` (prefix mount)
  because Express 5 rejects the `app.use('/auth/*', ...)` pattern from the
  Auth.js docs (path-to-regexp v8 requires named wildcards).
- `@auth/express` and `@auth/prisma-adapter` are ESM-only while this project
  compiles to CommonJS, so they are loaded with dynamic `import()` at startup
  (`src/auth/auth-loader.ts`).
- The Prisma client is generated locally (gitignored) and requires
  `prisma generate`. `pnpm install` runs this via `postinstall`; run
  `pnpm run db:generate` after schema changes.
- `AUTH_TRUST_HOST` is read as a boolean by `AuthService` — set to `"true"` to
  enable `trustHost` for Auth.js and `trust proxy` on Express (so Auth.js can
  detect HTTPS behind a reverse proxy); unset or any other value keeps both off
  for local dev.
- For a cross-domain frontend in production, set `FRONTEND_ORIGIN` to enable
  CORS with credentials, and deploy Auth.js cookies with
  `SameSite=None; Secure`. Same-site deployments work with the default
  `SameSite=Lax` cookies.

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ pnpm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
