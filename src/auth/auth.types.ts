// Auth.js session type augmentation.
//
// The default `@auth/express` `Session['user']` only promises `name`, `email`,
// and `image`. The `/me` endpoint documents `{ id, name, email, image }`, so we
// augment the Session interface to include `id` and populate it in the session
// callback (see `AuthService`).
//
// Reference: https://authjs.dev/getting-started/typescript
import type { DefaultSession } from '@auth/express'

declare module '@auth/express' {
  interface Session {
    user: {
      id: string
    } & DefaultSession['user']
  }
}
