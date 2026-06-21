import 'dotenv/config'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

/**
 * Resolve the CORS policy from the environment.
 *
 * `FRONTEND_ORIGIN` is the single allowed origin for a cross-domain frontend.
 * When unset, CORS is disabled (same-origin or no frontend). When set, the
 * browser is allowed to send credentials (the Auth.js session cookie), which
 * is required for a separate frontend to call `/me` after the backend-mounted
 * OAuth redirect.
 *
 * Note: for cross-origin cookies to land, the deployed Auth.js cookies must
 * also use `SameSite=None; Secure`. That is a deployment concern documented in
 * the README; this function only controls the NestJS CORS layer.
 */
function resolveCorsOptions():
  | boolean
  | { origin: string; credentials: boolean } {
  const origin = process.env['FRONTEND_ORIGIN']
  if (!origin) {
    return false
  }
  return {
    origin,
    credentials: true,
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.enableCors(resolveCorsOptions())
  await app.listen(process.env['PORT'] ?? 3000)
}

void bootstrap()
