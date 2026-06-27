import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { App } from 'supertest/types'
import { AppModule } from './../src/app.module'
import { AuthBootstrap } from './../src/auth/auth.bootstrap'
import { AuthService } from './../src/auth/auth.service'
import { PrismaService } from './../src/prisma/prisma.service'

type StoredRecipe = {
  id: string
  title: string
  description: string | null
  status: 'DRAFT' | 'PRIVATE' | 'PUBLIC'
  authorId: string
  createdAt: Date
  updatedAt: Date
}

type RecipeBody = Omit<StoredRecipe, 'createdAt' | 'updatedAt'> & {
  createdAt: string
  updatedAt: string
}

type RecipeCreateArgs = {
  data: Pick<StoredRecipe, 'title' | 'description' | 'status' | 'authorId'>
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
  data: Partial<Pick<StoredRecipe, 'title' | 'description' | 'status'>>
}

describe('RecipesController (e2e)', () => {
  let app: INestApplication<App>
  let recipes: StoredRecipe[]
  let nextRecipeNumber: number

  const startedAt = new Date('2026-06-27T10:00:00.000Z')

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

  it('creates an owner recipe with default draft status', async () => {
    const response = await request(app.getHttpServer())
      .post('/recipes')
      .set('x-user-id', 'user_1')
      .send({ title: 'Pasta' })
      .expect(201)

    expect(response.body).toMatchObject({
      id: 'recipe_1',
      title: 'Pasta',
      description: null,
      status: 'DRAFT',
    })
  })

  it('creates an owner recipe with explicit status', async () => {
    const response = await request(app.getHttpServer())
      .post('/recipes')
      .set('x-user-id', 'user_1')
      .send({ title: 'Secret', status: 'PRIVATE' })
      .expect(201)

    expect(response.body).toMatchObject({
      id: 'recipe_1',
      title: 'Secret',
      description: null,
      status: 'PRIVATE',
    })

    const listResponse = await request(app.getHttpServer())
      .get('/recipes')
      .set('x-user-id', 'user_1')
      .expect(200)

    expect(listResponse.body).toMatchObject([
      {
        id: 'recipe_1',
        title: 'Secret',
        description: null,
        status: 'PRIVATE',
      },
    ])
  })

  it('rejects title creation longer than 200 characters with 400', async () => {
    await request(app.getHttpServer())
      .post('/recipes')
      .set('x-user-id', 'user_1')
      .send({ title: 'x'.repeat(201) })
      .expect(400)
  })

  it('rejects description creation longer than 2000 characters with 400', async () => {
    await request(app.getHttpServer())
      .post('/recipes')
      .set('x-user-id', 'user_1')
      .send({ title: 'Pasta', description: 'x'.repeat(2001) })
      .expect(400)
  })

  it('accepts create title and description at max lengths', async () => {
    const title = 'x'.repeat(200)
    const description = 'y'.repeat(2000)

    const response = await request(app.getHttpServer())
      .post('/recipes')
      .set('x-user-id', 'user_1')
      .send({ title, description })
      .expect(201)

    expect(response.body).toMatchObject({
      id: 'recipe_1',
      title,
      description,
      status: 'DRAFT',
    })
  })

  it('lists only public recipes for anonymous users', async () => {
    seedRecipe({ id: 'public_1', status: 'PUBLIC', authorId: 'user_1' })
    seedRecipe({ id: 'public_2', status: 'PUBLIC', authorId: 'user_2' })
    seedRecipe({ id: 'private_1', status: 'PRIVATE', authorId: 'user_1' })
    seedRecipe({ id: 'draft_1', status: 'DRAFT', authorId: 'user_1' })

    const response = await request(app.getHttpServer())
      .get('/recipes/public')
      .expect(200)

    expect(response.body).toHaveLength(2)
    const body = response.body as RecipeBody[]
    expect(body.map((recipe) => recipe.id)).toEqual(['public_1', 'public_2'])
  })

  it('lists every recipe owned by the authenticated user', async () => {
    seedRecipe({ id: 'draft_1', status: 'DRAFT', authorId: 'user_1' })
    seedRecipe({ id: 'private_1', status: 'PRIVATE', authorId: 'user_1' })
    seedRecipe({ id: 'public_1', status: 'PUBLIC', authorId: 'user_1' })
    seedRecipe({ id: 'other_1', status: 'PUBLIC', authorId: 'user_2' })

    const response = await request(app.getHttpServer())
      .get('/recipes')
      .set('x-user-id', 'user_1')
      .expect(200)

    expect(response.body).toHaveLength(3)
    const body = response.body as RecipeBody[]
    expect(body.map((recipe) => recipe.status)).toEqual([
      'DRAFT',
      'PRIVATE',
      'PUBLIC',
    ])
  })

  it('hides private detail from anonymous users', async () => {
    seedRecipe({ id: 'private_1', status: 'PRIVATE', authorId: 'user_1' })

    await request(app.getHttpServer()).get('/recipes/private_1').expect(404)
  })

  it('returns private detail to the owner', async () => {
    seedRecipe({ id: 'private_1', status: 'PRIVATE', authorId: 'user_1' })

    const response = await request(app.getHttpServer())
      .get('/recipes/private_1')
      .set('x-user-id', 'user_1')
      .expect(200)

    expect(response.body).toMatchObject({ id: 'private_1', status: 'PRIVATE' })
  })

  it('hides private detail from non-owners', async () => {
    seedRecipe({ id: 'private_1', status: 'PRIVATE', authorId: 'user_1' })

    await request(app.getHttpServer())
      .get('/recipes/private_1')
      .set('x-user-id', 'user_2')
      .expect(404)
  })

  it('rejects anonymous updates with 401', async () => {
    seedRecipe({ id: 'recipe_1', status: 'DRAFT', authorId: 'user_1' })

    await request(app.getHttpServer())
      .patch('/recipes/recipe_1')
      .send({ title: 'New' })
      .expect(401)
  })

  it('updates owner recipe title and status', async () => {
    seedRecipe({ id: 'recipe_1', status: 'DRAFT', authorId: 'user_1' })

    const response = await request(app.getHttpServer())
      .patch('/recipes/recipe_1')
      .set('x-user-id', 'user_1')
      .send({ title: 'New', status: 'PUBLIC' })
      .expect(200)

    expect(response.body).toMatchObject({ title: 'New', status: 'PUBLIC' })
  })

  it('hides owner-only updates from non-owners', async () => {
    seedRecipe({ id: 'recipe_1', status: 'DRAFT', authorId: 'user_1' })

    await request(app.getHttpServer())
      .patch('/recipes/recipe_1')
      .set('x-user-id', 'user_2')
      .send({ title: 'Hijacked' })
      .expect(404)
  })

  it('rejects invalid update status with 400', async () => {
    seedRecipe({ id: 'recipe_1', status: 'DRAFT', authorId: 'user_1' })

    await request(app.getHttpServer())
      .patch('/recipes/recipe_1')
      .set('x-user-id', 'user_1')
      .send({ status: 'INVALID' })
      .expect(400)
  })

  it('rejects empty title creation with 400', async () => {
    await request(app.getHttpServer())
      .post('/recipes')
      .set('x-user-id', 'user_1')
      .send({ title: '' })
      .expect(400)
  })

  it('returns 404 for a missing recipe detail', async () => {
    await request(app.getHttpServer()).get('/recipes/missing').expect(404)
  })

  function seedRecipe(overrides: Partial<StoredRecipe>): StoredRecipe {
    const recipe: StoredRecipe = {
      id: overrides.id ?? `recipe_${nextRecipeNumber++}`,
      title: overrides.title ?? 'Recipe',
      description: overrides.description ?? null,
      status: overrides.status ?? 'DRAFT',
      authorId: overrides.authorId ?? 'user_1',
      createdAt: overrides.createdAt ?? startedAt,
      updatedAt: overrides.updatedAt ?? startedAt,
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
            status: data.status,
            authorId: data.authorId,
          })
          return Promise.resolve(recipe)
        }),
        findMany: jest.fn(({ where }: RecipeFindManyArgs) => {
          const result = recipes.filter((recipe) => {
            if (where?.authorId && recipe.authorId !== where.authorId) {
              return false
            }
            if (where?.status && recipe.status !== where.status) {
              return false
            }
            return true
          })
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
            updatedAt: new Date(startedAt.getTime() + 1),
          })
          return Promise.resolve(recipe)
        }),
      },
    } as unknown as Pick<PrismaService, 'recipe'>
  }
})
