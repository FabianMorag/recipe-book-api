import { mapSessionUserId } from './auth.service'
import type { Session } from './auth-loader'

/**
 * Unit tests for the Auth.js session callback helper.
 *
 * The callback is a pure function over a `Session` and an optional user
 * record, so it can be exercised directly without a live Google OAuth flow or
 * a live Prisma database. This covers the "session mapping includes id" case
 * from the review.
 */
describe('mapSessionUserId (Auth.js session callback)', () => {
  function buildSession(overrides: Partial<Session['user']> = {}): Session {
    return {
      user: {
        id: '',
        name: null,
        email: null,
        image: null,
        ...overrides,
      },
    }
  }

  it('forwards the user id onto the session user', () => {
    const session = buildSession()
    const result = mapSessionUserId({
      session,
      user: { id: 'user_123' },
    })
    expect(result.user.id).toBe('user_123')
  })

  it('leaves the session unchanged when the user is missing', () => {
    const session = buildSession({ id: 'preexisting' })
    const result = mapSessionUserId({ session, user: null })
    expect(result.user.id).toBe('preexisting')
  })

  it('leaves the session unchanged when the user has no id', () => {
    const session = buildSession({ id: 'preexisting' })
    const result = mapSessionUserId({ session, user: {} })
    expect(result.user.id).toBe('preexisting')
  })

  it('returns the same session object reference', () => {
    const session = buildSession()
    const result = mapSessionUserId({
      session,
      user: { id: 'user_456' },
    })
    expect(result).toBe(session)
  })
})
