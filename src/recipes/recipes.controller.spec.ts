import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import type { Request } from 'express'
import { RecipesController } from './recipes.controller'
import { RecipesService } from './recipes.service'
import { AuthService } from '../auth/auth.service'

describe('RecipesController', () => {
  let controller: RecipesController
  let recipesService: {
    create: jest.Mock
    findAllByOwner: jest.Mock
    findAllPublic: jest.Mock
    findOneOrNotFound: jest.Mock
    update: jest.Mock
  }
  let authService: { getSession: jest.Mock }

  const req = {} as Request
  const recipe = {
    id: 'recipe_1',
    title: 'Pasta',
    description: null,
    status: 'DRAFT',
    createdAt: new Date('2026-06-27T10:00:00.000Z'),
    updatedAt: new Date('2026-06-27T10:00:00.000Z'),
  }

  beforeEach(() => {
    recipesService = {
      create: jest.fn(),
      findAllByOwner: jest.fn(),
      findAllPublic: jest.fn(),
      findOneOrNotFound: jest.fn(),
      update: jest.fn(),
    }
    authService = { getSession: jest.fn() }
    controller = new RecipesController(
      recipesService as unknown as RecipesService,
      authService as unknown as AuthService,
    )
  })

  it('creates a recipe for the authenticated owner', async () => {
    authService.getSession.mockResolvedValue({ user: { id: 'user_1' } })
    recipesService.create.mockResolvedValue(recipe)

    await expect(controller.create(req, { title: 'Pasta' })).resolves.toEqual(
      recipe,
    )
    expect(recipesService.create).toHaveBeenCalledWith('user_1', {
      title: 'Pasta',
    })
  })

  it('throws UnauthorizedException when anonymous user creates a recipe', async () => {
    authService.getSession.mockResolvedValue(null)

    await expect(controller.create(req, { title: 'Pasta' })).rejects.toThrow(
      UnauthorizedException,
    )
  })

  it('propagates validation errors raised by the request pipeline', async () => {
    authService.getSession.mockResolvedValue({ user: { id: 'user_1' } })
    recipesService.create.mockRejectedValue(new BadRequestException())

    await expect(controller.create(req, { title: '' })).rejects.toThrow(
      BadRequestException,
    )
  })

  it('lists recipes owned by the authenticated user', async () => {
    authService.getSession.mockResolvedValue({ user: { id: 'user_1' } })
    recipesService.findAllByOwner.mockResolvedValue([recipe])

    await expect(controller.findMine(req)).resolves.toEqual([recipe])
    expect(recipesService.findAllByOwner).toHaveBeenCalledWith('user_1')
  })

  it('throws UnauthorizedException when anonymous user lists owned recipes', async () => {
    authService.getSession.mockResolvedValue(null)

    await expect(controller.findMine(req)).rejects.toThrow(
      UnauthorizedException,
    )
  })

  it('lists public recipes for anonymous users', async () => {
    authService.getSession.mockResolvedValue(null)
    recipesService.findAllPublic.mockResolvedValue([
      { ...recipe, status: 'PUBLIC' },
    ])

    await expect(controller.findPublic()).resolves.toEqual([
      { ...recipe, status: 'PUBLIC' },
    ])
  })

  it('lists public recipes for authenticated users', async () => {
    authService.getSession.mockResolvedValue({ user: { id: 'user_1' } })
    recipesService.findAllPublic.mockResolvedValue([
      { ...recipe, status: 'PUBLIC' },
    ])

    await expect(controller.findPublic()).resolves.toHaveLength(1)
  })

  it('returns public detail for anonymous users', async () => {
    authService.getSession.mockResolvedValue(null)
    recipesService.findOneOrNotFound.mockResolvedValue({
      ...recipe,
      status: 'PUBLIC',
    })

    await expect(controller.findOne(req, 'recipe_1')).resolves.toMatchObject({
      id: 'recipe_1',
      status: 'PUBLIC',
    })
    expect(recipesService.findOneOrNotFound).toHaveBeenCalledWith(
      'recipe_1',
      null,
    )
  })

  it('passes owner identity to detail lookup', async () => {
    authService.getSession.mockResolvedValue({ user: { id: 'user_1' } })
    recipesService.findOneOrNotFound.mockResolvedValue(recipe)

    await controller.findOne(req, 'recipe_1')

    expect(recipesService.findOneOrNotFound).toHaveBeenCalledWith(
      'recipe_1',
      'user_1',
    )
  })

  it('propagates NotFoundException for hidden or missing detail', async () => {
    authService.getSession.mockResolvedValue({ user: { id: 'user_2' } })
    recipesService.findOneOrNotFound.mockRejectedValue(new NotFoundException())

    await expect(controller.findOne(req, 'recipe_1')).rejects.toThrow(
      NotFoundException,
    )
  })

  it('updates a recipe for the authenticated owner', async () => {
    authService.getSession.mockResolvedValue({ user: { id: 'user_1' } })
    recipesService.update.mockResolvedValue({ ...recipe, title: 'New' })

    await expect(
      controller.update(req, 'recipe_1', { title: 'New' }),
    ).resolves.toMatchObject({ title: 'New' })
    expect(recipesService.update).toHaveBeenCalledWith('recipe_1', 'user_1', {
      title: 'New',
    })
  })

  it('throws UnauthorizedException when anonymous user updates a recipe', async () => {
    authService.getSession.mockResolvedValue(null)

    await expect(
      controller.update(req, 'recipe_1', { title: 'New' }),
    ).rejects.toThrow(UnauthorizedException)
  })

  it('propagates NotFoundException for non-owner updates', async () => {
    authService.getSession.mockResolvedValue({ user: { id: 'user_2' } })
    recipesService.update.mockRejectedValue(new NotFoundException())

    await expect(
      controller.update(req, 'recipe_1', { title: 'Hijacked' }),
    ).rejects.toThrow(NotFoundException)
  })

  it('propagates BadRequestException for invalid update status', async () => {
    authService.getSession.mockResolvedValue({ user: { id: 'user_1' } })
    recipesService.update.mockRejectedValue(new BadRequestException())

    await expect(
      controller.update(req, 'recipe_1', { status: 'INVALID' } as never),
    ).rejects.toThrow(BadRequestException)
  })
})
