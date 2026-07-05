import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { App } from 'supertest/types'
import { AppModule } from './../src/app.module'
import { AuthBootstrap } from './../src/auth/auth.bootstrap'
import { AuthService } from './../src/auth/auth.service'
import { PrismaService } from './../src/prisma/prisma.service'
import { RecipeStatus } from './../src/generated/prisma/enums'

type RecipeAuthor = {
  id: string
  name: string | null
  image: string | null
}

type StoredRecipe = {
  id: string
  title: string
  description: string | null
  servings: number | null
  imageUrl: string | null
  tags: string[]
  status: RecipeStatus
  authorId: string
  author: RecipeAuthor
  createdAt: Date
  updatedAt: Date
}

type RecipeBody = Omit<StoredRecipe, 'createdAt' | 'updatedAt'> & {
  createdAt: string
  updatedAt: string
}

type RecipeCreateArgs = {
  data: Pick<
    StoredRecipe,
    | 'title'
    | 'description'
    | 'servings'
    | 'imageUrl'
    | 'tags'
    | 'status'
    | 'authorId'
  >
}

type RecipeFindManyArgs = {
  where?: Partial<Pick<StoredRecipe, 'authorId' | 'status'>>
}

type RecipeIdArgs = {
  where: Pick<StoredRecipe, 'id'>
}

type RecipeFindFirstArgs = {
  where: Pick<StoredRecipe, 'id' | 'authorId'>
}

type RecipeUpdateArgs = RecipeIdArgs & {
  data: Partial<
    Pick<
      StoredRecipe,
      'title' | 'description' | 'servings' | 'imageUrl' | 'tags' | 'status'
    >
  >
}

describe('RecipesController (e2e)', () => {
  let app: INestApplication<App>
  let recipes: StoredRecipe[]
  let nextRecipeNumber: number

  const startedAt = new Date('2026-06-27T10:00:00.000Z')
  const defaultAuthor = { id: 'user_1', name: null, image: null }
  const aliceAuthor = {
    id: 'user_1',
    name: 'Alice',
    image: 'https://example.com/alice.jpg',
  }

  beforeEach(async () => {
    recipes = []
    nextRecipeNumber = 1

    const prisma = buildPrismaFake()
    const authService = {
      getSession: jest.fn(
        (req: { headers: Record<string, string | undefined> }) => {
          const userId = req.headers['x-user-id']
          return Promise.resolve(userId ? { user: { id: userId } } : null)
        },
      ),
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(AuthBootstrap)
      .useValue({ onModuleInit: jest.fn() })
      .overrideProvider(AuthService)
      .useValue(authService)
      .compile()

    app = moduleFixture.createNestApplication()
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    )
    await app.init()
  })

  afterEach(async () => {
    if (app) {
      await app.close()
    }
  })

  it('rejects anonymous recipe creation with 401', async () => {
    await request(app.getHttpServer())
      .post('/recipes')
      .send({ title: 'Pasta' })
      .expect(401)
  })

  it('creates recipe with default content fields and author profile', async () => {
    const response = await request(app.getHttpServer())
      .post('/recipes')
      .set('x-user-id', 'user_1')
      .send({ title: 'Pasta' })
      .expect(201)

    expect(response.body).toMatchObject({
      id: 'recipe_1',
      title: 'Pasta',
      description: null,
      servings: null,
      imageUrl: null,
      tags: [],
      status: 'DRAFT',
      author: defaultAuthor,
    })
  })

  it('creates recipe with explicit servings, imageUrl, and tags', async () => {
    const response = await request(app.getHttpServer())
      .post('/recipes')
      .set('x-user-id', 'user_1')
      .send({
        title: 'Pasta',
        servings: 4,
        imageUrl: 'https://example.com/pasta.jpg',
        tags: ['italian', 'quick'],
        status: 'PUBLIC',
      })
      .expect(201)

    expect(response.body).toMatchObject({
      title: 'Pasta',
      servings: 4,
      imageUrl: 'https://example.com/pasta.jpg',
      tags: ['italian', 'quick'],
      status: 'PUBLIC',
      author: defaultAuthor,
    })
  })

  it('rejects invalid servings, imageUrl, and tags with 400', async () => {
    const cases = [
      { body: { title: 'Pasta', servings: 0 } },
      { body: { title: 'Pasta', servings: -1 } },
      { body: { title: 'Pasta', servings: 2.5 } },
      { body: { title: 'Pasta', imageUrl: 'not-a-url' } },
      { body: { title: 'Pasta', tags: ['', '  '] } },
      {
        body: {
          title: 'Pasta',
          tags: Array.from({ length: 21 }, (_, i) => `tag-${i}`),
        },
      },
      { body: { title: 'Pasta', tags: 'not-array' } },
      { body: { title: 'Pasta', tags: null } },
    ] as const

    for (const testCase of cases) {
      await request(app.getHttpServer())
        .post('/recipes')
        .set('x-user-id', 'user_1')
        .send(testCase.body)
        .expect(400)
    }
  })

  it('defaults tags to an empty array when omitted on create', async () => {
    const response = await request(app.getHttpServer())
      .post('/recipes')
      .set('x-user-id', 'user_1')
      .send({ title: 'Pasta' })
      .expect(201)
    const body = response.body as RecipeBody

    expect(body.tags).toEqual([])
  })

  it('lists every recipe owned by the authenticated user with author profiles', async () => {
    seedRecipe({
      id: 'draft_1',
      status: RecipeStatus.DRAFT,
      authorId: 'user_1',
    })
    seedRecipe({
      id: 'private_1',
      status: RecipeStatus.PRIVATE,
      authorId: 'user_1',
    })
    seedRecipe({
      id: 'public_1',
      status: RecipeStatus.PUBLIC,
      authorId: 'user_1',
    })
    seedRecipe({
      id: 'other_1',
      status: RecipeStatus.PUBLIC,
      authorId: 'user_2',
    })

    const response = await request(app.getHttpServer())
      .get('/recipes')
      .set('x-user-id', 'user_1')
      .expect(200)
    const body = response.body as RecipeBody[]

    expect(body).toHaveLength(3)
    expect(body.map((recipe) => recipe.status)).toEqual([
      'PUBLIC',
      'PRIVATE',
      'DRAFT',
    ])
    expect(body.every((recipe) => recipe.author)).toBe(true)
    expect(body.every((recipe) => recipe.authorId === undefined)).toBe(true)
  })

  it('lists only public recipes for anonymous users with author profiles', async () => {
    seedRecipe({
      id: 'public_1',
      status: RecipeStatus.PUBLIC,
      authorId: 'user_1',
    })
    seedRecipe({
      id: 'public_2',
      status: RecipeStatus.PUBLIC,
      authorId: 'user_2',
    })
    seedRecipe({
      id: 'private_1',
      status: RecipeStatus.PRIVATE,
      authorId: 'user_1',
    })
    seedRecipe({
      id: 'draft_1',
      status: RecipeStatus.DRAFT,
      authorId: 'user_1',
    })

    const response = await request(app.getHttpServer())
      .get('/recipes/public')
      .expect(200)
    const body = response.body as RecipeBody[]

    expect(body).toHaveLength(2)
    expect(body.map((recipe) => recipe.id)).toEqual(['public_2', 'public_1'])
    expect(body.every((recipe) => recipe.author)).toBe(true)
  })

  it('returns public recipe detail with author profile', async () => {
    seedRecipe({
      id: 'public_1',
      status: RecipeStatus.PUBLIC,
      servings: 4,
      imageUrl: 'https://example.com/img.jpg',
      tags: ['dinner'],
      authorId: 'user_1',
      author: aliceAuthor,
    })

    const response = await request(app.getHttpServer())
      .get('/recipes/public_1')
      .expect(200)

    expect(response.body).toMatchObject({
      id: 'public_1',
      status: 'PUBLIC',
      servings: 4,
      imageUrl: 'https://example.com/img.jpg',
      tags: ['dinner'],
      author: aliceAuthor,
    })
    expect(response.body).not.toHaveProperty('authorId')
  })

  it('hides private detail from anonymous users', async () => {
    seedRecipe({
      id: 'private_1',
      status: RecipeStatus.PRIVATE,
      authorId: 'user_1',
    })

    await request(app.getHttpServer()).get('/recipes/private_1').expect(404)
  })

  it('returns private detail to the owner', async () => {
    seedRecipe({
      id: 'private_1',
      status: RecipeStatus.PRIVATE,
      servings: 2,
      imageUrl: null,
      tags: ['family'],
      authorId: 'user_1',
      author: aliceAuthor,
    })

    const response = await request(app.getHttpServer())
      .get('/recipes/private_1')
      .set('x-user-id', 'user_1')
      .expect(200)

    expect(response.body).toMatchObject({
      id: 'private_1',
      status: 'PRIVATE',
      servings: 2,
      imageUrl: null,
      tags: ['family'],
      author: aliceAuthor,
    })
  })

  it('hides private detail from non-owners', async () => {
    seedRecipe({
      id: 'private_1',
      status: RecipeStatus.PRIVATE,
      authorId: 'user_1',
    })

    await request(app.getHttpServer())
      .get('/recipes/private_1')
      .set('x-user-id', 'user_2')
      .expect(404)
  })

  it('updates owner recipe content fields', async () => {
    seedRecipe({
      id: 'recipe_1',
      status: RecipeStatus.DRAFT,
      authorId: 'user_1',
    })

    const response = await request(app.getHttpServer())
      .patch('/recipes/recipe_1')
      .set('x-user-id', 'user_1')
      .send({
        servings: 6,
        imageUrl: 'https://example.com/new.jpg',
        tags: ['updated'],
      })
      .expect(200)

    expect(response.body).toMatchObject({
      servings: 6,
      imageUrl: 'https://example.com/new.jpg',
      tags: ['updated'],
      author: defaultAuthor,
    })
  })

  it('clears optional content fields on update', async () => {
    seedRecipe({
      id: 'recipe_1',
      status: RecipeStatus.DRAFT,
      servings: 4,
      imageUrl: 'https://example.com/old.jpg',
      tags: ['lunch'],
      authorId: 'user_1',
    })

    const response = await request(app.getHttpServer())
      .patch('/recipes/recipe_1')
      .set('x-user-id', 'user_1')
      .send({ servings: null, imageUrl: null, tags: null })
      .expect(200)

    expect(response.body).toMatchObject({
      servings: null,
      imageUrl: null,
      tags: [],
    })
  })

  it('rejects null title and status updates with 400', async () => {
    seedRecipe({
      id: 'recipe_1',
      status: RecipeStatus.DRAFT,
      authorId: 'user_1',
    })

    for (const body of [{ title: null }, { status: null }]) {
      await request(app.getHttpServer())
        .patch('/recipes/recipe_1')
        .set('x-user-id', 'user_1')
        .send(body)
        .expect(400)
    }
  })

  it('rejects invalid update status with 400', async () => {
    seedRecipe({
      id: 'recipe_1',
      status: RecipeStatus.DRAFT,
      authorId: 'user_1',
    })

    await request(app.getHttpServer())
      .patch('/recipes/recipe_1')
      .set('x-user-id', 'user_1')
      .send({ status: 'INVALID' })
      .expect(400)
  })

  it('hides owner-only updates from non-owners', async () => {
    seedRecipe({
      id: 'recipe_1',
      status: RecipeStatus.DRAFT,
      authorId: 'user_1',
    })

    await request(app.getHttpServer())
      .patch('/recipes/recipe_1')
      .set('x-user-id', 'user_2')
      .send({ title: 'Hijacked' })
      .expect(404)
  })

  function seedRecipe(overrides: Partial<StoredRecipe>): StoredRecipe {
    const sequence = nextRecipeNumber++
    const recipe: StoredRecipe = {
      id: overrides.id ?? `recipe_${sequence}`,
      title: overrides.title ?? 'Recipe',
      description: overrides.description ?? null,
      servings: overrides.servings ?? null,
      imageUrl: overrides.imageUrl ?? null,
      tags: overrides.tags ?? [],
      status: overrides.status ?? RecipeStatus.DRAFT,
      authorId: overrides.authorId ?? 'user_1',
      author: overrides.author ?? {
        id: overrides.authorId ?? 'user_1',
        name: null,
        image: null,
      },
      createdAt:
        overrides.createdAt ?? new Date(startedAt.getTime() + sequence),
      updatedAt:
        overrides.updatedAt ?? new Date(startedAt.getTime() + sequence),
    }
    recipes.push(recipe)
    return recipe
  }

  function buildPrismaFake(): Pick<PrismaService, 'recipe'> {
    return {
      recipe: {
        create: jest.fn(({ data }: RecipeCreateArgs) => {
          const recipe = seedRecipe({
            title: data.title,
            description: data.description,
            servings: data.servings,
            imageUrl: data.imageUrl,
            tags: data.tags,
            status: data.status,
            authorId: data.authorId,
          })
          return Promise.resolve(recipe)
        }),
        findMany: jest.fn(({ where }: RecipeFindManyArgs) => {
          const result = recipes
            .filter((recipe) => {
              if (where?.authorId && recipe.authorId !== where.authorId) {
                return false
              }
              if (where?.status && recipe.status !== where.status) {
                return false
              }
              return true
            })
            .sort(
              (left, right) =>
                right.createdAt.getTime() - left.createdAt.getTime(),
            )
          return Promise.resolve(result)
        }),
        findUnique: jest.fn(({ where }: RecipeIdArgs) => {
          return Promise.resolve(
            recipes.find((recipe) => recipe.id === where.id) ?? null,
          )
        }),
        findFirst: jest.fn(({ where }: RecipeFindFirstArgs) => {
          return Promise.resolve(
            recipes.find(
              (recipe) =>
                recipe.id === where.id && recipe.authorId === where.authorId,
            ) ?? null,
          )
        }),
        update: jest.fn(({ where, data }: RecipeUpdateArgs) => {
          const recipe = recipes.find((item) => item.id === where.id)
          if (!recipe) {
            throw new Error('Recipe not found')
          }
          Object.assign(recipe, data, {
            updatedAt: new Date(recipe.updatedAt.getTime() + 1),
          })
          return Promise.resolve(recipe)
        }),
      },
    } as unknown as Pick<PrismaService, 'recipe'>
  }
})
