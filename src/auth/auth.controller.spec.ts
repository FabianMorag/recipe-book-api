import { Test, TestingModule } from '@nestjs/testing'
import { UnauthorizedException } from '@nestjs/common'
import type { Request } from 'express'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'

/**
 * Controller-level tests for the `/me` identity endpoint.
 *
 * These tests intentionally avoid live Google OAuth and a live database: they
 * stub {@link AuthService.getSession} so we only verify the controller's
 * contract — 401 when there is no session, and the mapped user payload when a
 * session exists (including the `id` promised by the README).
 */
describe('AuthController', () => {
  let controller: AuthController
  let authService: { getSession: jest.Mock }

  beforeEach(async () => {
    authService = { getSession: jest.fn() }

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile()

    controller = module.get<AuthController>(AuthController)
  })

  it('throws UnauthorizedException when there is no session', async () => {
    authService.getSession.mockResolvedValue(null)

    await expect(controller.getMe({} as Request)).rejects.toThrow(
      UnauthorizedException,
    )
    expect(authService.getSession).toHaveBeenCalledTimes(1)
  })

  it('throws UnauthorizedException when the session has no user', async () => {
    authService.getSession.mockResolvedValue({ user: null })

    await expect(controller.getMe({} as Request)).rejects.toThrow(
      UnauthorizedException,
    )
  })

  it('returns the session user (including id) when authenticated', async () => {
    const user = {
      id: 'user_123',
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      image: null,
    }
    authService.getSession.mockResolvedValue({ user })

    await expect(controller.getMe({} as Request)).resolves.toEqual({ user })
  })
})
