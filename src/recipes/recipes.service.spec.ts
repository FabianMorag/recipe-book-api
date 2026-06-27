import { BadRequestException, NotFoundException } from '@nestjs/common'
import { RecipesService } from './recipes.service'
import { PrismaService } from '../prisma/prisma.service'

describe('RecipesService', () => {
  let service: RecipesService
  let prisma: {
    recipe: {
      create: jest.Mock
      findMany: jest.Mock
      findUnique: jest.Mock
      findFirst: jest.Mock
      update: jest.Mock
    }
  }

  const now = new Date('2026-06-27T10:00:00.000Z')
  const baseRecipe = {
    id: 'recipe_1',
    title: 'Pasta',
    description: null,
    status: 'DRAFT',
    authorId: 'user_1',
    createdAt: now,
    updatedAt: now,
  }

  beforeEach(() => {
    prisma = {
      recipe: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    }
    service = new RecipesService(prisma as unknown as PrismaService)
  })

  it('creates a draft recipe with null description by default', async () => {
    prisma.recipe.create.mockResolvedValue(baseRecipe)

    await expect(service.create('user_1', { title: 'Pasta' })).resolves.toEqual(
      {
        id: 'recipe_1',
        title: 'Pasta',
        description: null,
        status: 'DRAFT',
        createdAt: now,
        updatedAt: now,
      },
    )
    expect(prisma.recipe.create).toHaveBeenCalledWith({
      data: {
        title: 'Pasta',
        description: null,
        status: 'DRAFT',
        authorId: 'user_1',
      },
    })
  })

  it('creates a recipe with an explicit private status and description', async () => {
    prisma.recipe.create.mockResolvedValue({
      ...baseRecipe,
      title: 'Secret',
      description: 'Family recipe',
      status: 'PRIVATE',
    })

    await expect(
      service.create('user_1', {
        title: 'Secret',
        description: 'Family recipe',
        status: 'PRIVATE',
      }),
    ).resolves.toMatchObject({
      title: 'Secret',
      description: 'Family recipe',
      status: 'PRIVATE',
    })
  })

  it('lists every recipe owned by a user regardless of status', async () => {
    prisma.recipe.findMany.mockResolvedValue([
      { ...baseRecipe, status: 'DRAFT' },
      { ...baseRecipe, id: 'recipe_2', status: 'PRIVATE' },
      { ...baseRecipe, id: 'recipe_3', status: 'PUBLIC' },
    ])

    const result = await service.findAllByOwner('user_1')

    expect(result).toHaveLength(3)
    expect(result.map((recipe) => recipe.status)).toEqual([
      'DRAFT',
      'PRIVATE',
      'PUBLIC',
    ])
    expect(prisma.recipe.findMany).toHaveBeenCalledWith({
      where: { authorId: 'user_1' },
      orderBy: { createdAt: 'desc' },
      select: RecipesService.listSelect,
    })
  })

  it('lists only public recipes', async () => {
    prisma.recipe.findMany.mockResolvedValue([
      { ...baseRecipe, status: 'PUBLIC' },
      { ...baseRecipe, id: 'recipe_2', status: 'PUBLIC' },
    ])

    const result = await service.findAllPublic()

    expect(result).toHaveLength(2)
    expect(result.every((recipe) => recipe.status === 'PUBLIC')).toBe(true)
    expect(prisma.recipe.findMany).toHaveBeenCalledWith({
      where: { status: 'PUBLIC' },
      orderBy: { createdAt: 'desc' },
      select: RecipesService.listSelect,
    })
  })

  it('returns a public recipe detail for anonymous users', async () => {
    prisma.recipe.findUnique.mockResolvedValue({
      ...baseRecipe,
      status: 'PUBLIC',
    })

    await expect(service.findOneOrNotFound('recipe_1', null)).resolves.toEqual({
      id: 'recipe_1',
      title: 'Pasta',
      description: null,
      status: 'PUBLIC',
      createdAt: now,
      updatedAt: now,
    })
  })

  it('returns private recipe detail only to the owner', async () => {
    prisma.recipe.findUnique.mockResolvedValue({
      ...baseRecipe,
      status: 'PRIVATE',
    })

    await expect(
      service.findOneOrNotFound('recipe_1', 'user_1'),
    ).resolves.toEqual(
      expect.objectContaining({ id: 'recipe_1', status: 'PRIVATE' }),
    )
  })

  it('hides private recipe detail from non-owners', async () => {
    prisma.recipe.findUnique.mockResolvedValue({
      ...baseRecipe,
      status: 'PRIVATE',
    })

    await expect(
      service.findOneOrNotFound('recipe_1', 'user_2'),
    ).rejects.toThrow(NotFoundException)
  })

  it('throws NotFoundException when recipe detail is missing', async () => {
    prisma.recipe.findUnique.mockResolvedValue(null)

    await expect(service.findOneOrNotFound('missing', null)).rejects.toThrow(
      NotFoundException,
    )
  })

  it('updates a recipe owned by the user without changing ownership', async () => {
    prisma.recipe.findFirst.mockResolvedValue(baseRecipe)
    prisma.recipe.update.mockResolvedValue({
      ...baseRecipe,
      title: 'New Pasta',
      status: 'PUBLIC',
    })

    await expect(
      service.update('recipe_1', 'user_1', {
        title: 'New Pasta',
        status: 'PUBLIC',
      }),
    ).resolves.toMatchObject({ title: 'New Pasta', status: 'PUBLIC' })
    expect(prisma.recipe.update).toHaveBeenCalledWith({
      where: { id: 'recipe_1' },
      data: { title: 'New Pasta', status: 'PUBLIC' },
    })
  })

  it('hides owner-only updates from non-owners', async () => {
    prisma.recipe.findFirst.mockResolvedValue(null)

    await expect(
      service.update('recipe_1', 'user_2', { title: 'Hijacked' }),
    ).rejects.toThrow(NotFoundException)
  })

  it('rejects invalid status values before updating', async () => {
    await expect(
      service.update('recipe_1', 'user_1', { status: 'INVALID' } as never),
    ).rejects.toThrow(BadRequestException)
    expect(prisma.recipe.findFirst).not.toHaveBeenCalled()
  })
})
