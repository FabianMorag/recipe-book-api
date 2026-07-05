import { BadRequestException, NotFoundException } from '@nestjs/common'
import { RecipeStatus } from '../generated/prisma/enums'
import { PrismaService } from '../prisma/prisma.service'
import { RecipesService } from './recipes.service'

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
  const expectedAuthor = {
    id: 'user_1',
    name: 'Alice',
    image: null,
  }
  const expectedAuthorSelect = {
    id: true,
    name: true,
    image: true,
  } as const
  const expectedListSelect = {
    id: true,
    title: true,
    description: true,
    servings: true,
    imageUrl: true,
    tags: true,
    status: true,
    createdAt: true,
    author: { select: expectedAuthorSelect },
  } as const
  const expectedDetailSelect = {
    ...expectedListSelect,
    updatedAt: true,
    authorId: true,
    author: { select: expectedAuthorSelect },
  } as const
  const baseRecipe = {
    id: 'recipe_1',
    title: 'Pasta',
    description: null,
    servings: null,
    imageUrl: null,
    tags: [],
    status: RecipeStatus.DRAFT,
    authorId: 'user_1',
    author: expectedAuthor,
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

  it('creates a draft recipe with default servings/imageUrl/tags and author', async () => {
    prisma.recipe.create.mockResolvedValue(baseRecipe)

    await expect(
      service.create('user_1', { title: 'Pasta' }),
    ).resolves.toMatchObject({
      id: 'recipe_1',
      title: 'Pasta',
      description: null,
      servings: null,
      imageUrl: null,
      tags: [],
      status: RecipeStatus.DRAFT,
      createdAt: now,
      updatedAt: now,
      author: expectedAuthor,
    })
    expect(prisma.recipe.create).toHaveBeenCalledWith({
      data: {
        title: 'Pasta',
        description: null,
        servings: null,
        imageUrl: null,
        tags: [],
        status: RecipeStatus.DRAFT,
        authorId: 'user_1',
      },
      select: expectedDetailSelect,
    })
  })

  it('creates a recipe with explicit servings, imageUrl, and tags', async () => {
    const recipeWithFields = {
      ...baseRecipe,
      servings: 4,
      imageUrl: 'https://example.com/img.jpg',
      tags: ['italian', 'quick'],
      author: { id: 'user_1', name: null, image: null },
    }
    prisma.recipe.create.mockResolvedValue(recipeWithFields)

    await expect(
      service.create('user_1', {
        title: 'Pasta',
        servings: 4,
        imageUrl: 'https://example.com/img.jpg',
        tags: ['italian', 'quick'],
      }),
    ).resolves.toMatchObject({
      servings: 4,
      imageUrl: 'https://example.com/img.jpg',
      tags: ['italian', 'quick'],
      author: { id: 'user_1', name: null, image: null },
    })
    expect(prisma.recipe.create).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          servings: 4,
          imageUrl: 'https://example.com/img.jpg',
          tags: ['italian', 'quick'],
        }),
        select: expectedDetailSelect,
      }),
    )
  })

  it('lists every recipe owned by a user regardless of status', async () => {
    prisma.recipe.findMany.mockResolvedValue([
      baseRecipe,
      { ...baseRecipe, id: 'recipe_2', status: RecipeStatus.PRIVATE },
      {
        ...baseRecipe,
        id: 'recipe_3',
        status: RecipeStatus.PUBLIC,
        servings: 4,
        imageUrl: 'https://example.com/img.jpg',
        tags: ['dinner'],
      },
    ])

    const result = await service.findAllByOwner('user_1')

    expect(result).toHaveLength(3)
    expect(result[0]).toMatchObject({
      servings: null,
      imageUrl: null,
      tags: [],
      author: expectedAuthor,
    })
    expect(result[1]).toMatchObject({
      servings: null,
      imageUrl: null,
      tags: [],
      author: expectedAuthor,
    })
    expect(result[2]).toMatchObject({
      servings: 4,
      imageUrl: 'https://example.com/img.jpg',
      tags: ['dinner'],
      author: expectedAuthor,
    })
    expect(result.map((recipe) => recipe.status)).toEqual([
      RecipeStatus.DRAFT,
      RecipeStatus.PRIVATE,
      RecipeStatus.PUBLIC,
    ])
    expect(
      result.every(
        (recipe) => !Object.prototype.hasOwnProperty.call(recipe, 'authorId'),
      ),
    ).toBe(true)
    expect(prisma.recipe.findMany).toHaveBeenCalledWith({
      where: { authorId: 'user_1' },
      orderBy: { createdAt: 'desc' },
      select: expectedListSelect,
    })
  })

  it('lists only public recipes', async () => {
    prisma.recipe.findMany.mockResolvedValue([
      {
        ...baseRecipe,
        status: RecipeStatus.PUBLIC,
        author: {
          id: 'user_1',
          name: 'Alice',
          image: 'https://example.com/alice.jpg',
        },
      },
      {
        ...baseRecipe,
        id: 'recipe_2',
        status: RecipeStatus.PUBLIC,
        servings: 2,
        imageUrl: null,
        tags: ['quick'],
        author: { id: 'user_2', name: null, image: null },
      },
    ])

    const result = await service.findAllPublic()

    expect(result).toHaveLength(2)
    expect(
      result.every((recipe) => recipe.status === RecipeStatus.PUBLIC),
    ).toBe(true)
    expect(result[0]).toMatchObject({
      servings: null,
      imageUrl: null,
      tags: [],
      author: {
        id: 'user_1',
        name: 'Alice',
        image: 'https://example.com/alice.jpg',
      },
    })
    expect(result[1]).toMatchObject({
      servings: 2,
      imageUrl: null,
      tags: ['quick'],
      author: { id: 'user_2', name: null, image: null },
    })
    expect(prisma.recipe.findMany).toHaveBeenCalledWith({
      where: { status: RecipeStatus.PUBLIC },
      orderBy: { createdAt: 'desc' },
      select: expectedListSelect,
    })
  })

  it('returns a public recipe detail for anonymous users', async () => {
    prisma.recipe.findUnique.mockResolvedValue({
      ...baseRecipe,
      status: RecipeStatus.PUBLIC,
      author: {
        id: 'user_1',
        name: 'Alice',
        image: 'https://example.com/alice.jpg',
      },
    })

    await expect(
      service.findOneOrNotFound('recipe_1', null),
    ).resolves.toMatchObject({
      id: 'recipe_1',
      title: 'Pasta',
      description: null,
      servings: null,
      imageUrl: null,
      tags: [],
      status: RecipeStatus.PUBLIC,
      createdAt: now,
      updatedAt: now,
      author: {
        id: 'user_1',
        name: 'Alice',
        image: 'https://example.com/alice.jpg',
      },
    })
  })

  it('returns private recipe detail only to the owner', async () => {
    prisma.recipe.findUnique.mockResolvedValue({
      ...baseRecipe,
      status: RecipeStatus.PRIVATE,
      author: { id: 'user_1', name: 'Alice', image: null },
    })

    await expect(
      service.findOneOrNotFound('recipe_1', 'user_1'),
    ).resolves.toMatchObject({
      id: 'recipe_1',
      status: RecipeStatus.PRIVATE,
      servings: null,
      imageUrl: null,
      tags: [],
      author: { id: 'user_1', name: 'Alice', image: null },
    })
  })

  it('hides private recipe detail from non-owners', async () => {
    prisma.recipe.findUnique.mockResolvedValue({
      ...baseRecipe,
      status: RecipeStatus.PRIVATE,
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
      servings: 6,
      imageUrl: 'https://example.com/new.jpg',
      tags: ['updated'],
      author: { id: 'user_1', name: 'Alice', image: null },
    })

    await expect(
      service.update('recipe_1', 'user_1', {
        servings: 6,
        imageUrl: 'https://example.com/new.jpg',
        tags: ['updated'],
      }),
    ).resolves.toMatchObject({
      servings: 6,
      imageUrl: 'https://example.com/new.jpg',
      tags: ['updated'],
      author: { id: 'user_1', name: 'Alice', image: null },
    })
    expect(prisma.recipe.update).toHaveBeenCalledWith({
      where: { id: 'recipe_1' },
      data: {
        servings: 6,
        imageUrl: 'https://example.com/new.jpg',
        tags: ['updated'],
      },
      select: expectedDetailSelect,
    })
  })

  it('clears optional content fields when null is provided on update', async () => {
    prisma.recipe.findFirst.mockResolvedValue(baseRecipe)
    prisma.recipe.update.mockResolvedValue({
      ...baseRecipe,
      servings: null,
      imageUrl: null,
      tags: [],
      author: expectedAuthor,
    })

    await expect(
      service.update('recipe_1', 'user_1', {
        servings: null,
        imageUrl: null,
        tags: null,
      }),
    ).resolves.toMatchObject({
      servings: null,
      imageUrl: null,
      tags: [],
      author: expectedAuthor,
    })
    expect(prisma.recipe.update).toHaveBeenCalledWith({
      where: { id: 'recipe_1' },
      data: {
        servings: null,
        imageUrl: null,
        tags: [],
      },
      select: expectedDetailSelect,
    })
  })

  it('coerces null tags to empty array in list response', async () => {
    prisma.recipe.findMany.mockResolvedValue([
      {
        ...baseRecipe,
        tags: null,
        author: expectedAuthor,
      },
    ])

    const result = await service.findAllByOwner('user_1')

    expect(result[0]).toMatchObject({ tags: [] })
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
