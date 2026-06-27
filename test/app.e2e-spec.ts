import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types'
import { AppModule } from './../src/app.module'
import { PrismaService } from './../src/prisma/prisma.service'
import { AuthBootstrap } from './../src/auth/auth.bootstrap'
import { configureOpenApi } from './../src/openapi'

type OpenApiOperation = {
  security?: Array<Record<string, string[]>>
  requestBody?: {
    content?: Record<string, { schema?: unknown }>
  }
  responses?: Record<string, { content?: Record<string, { schema?: unknown }> }>
}

type OpenApiDocument = {
  info: { title: string; version: string }
  paths: Record<string, Record<string, OpenApiOperation>>
  components?: {
    securitySchemes?: Record<string, unknown>
    schemas?: Record<string, unknown>
  }
}

const jsonSchemaRef = (schemaName: string) => ({
  $ref: `#/components/schemas/${schemaName}`,
})

const expectObjectContaining = (sample: Record<string, unknown>): unknown =>
  expect.objectContaining(sample) as unknown

const expectArrayContaining = (sample: unknown[]): unknown =>
  expect.arrayContaining(sample) as unknown

/**
 * AppController (e2e).
 *
 * The full `AppModule` eagerly instantiates `PrismaService` (which, under
 * Prisma 7, needs `DATABASE_URL` to build the driver adapter) and runs
 * `AuthBootstrap.onModuleInit` (which loads the Auth.js ESM runtime and needs
 * OAuth env). Neither is required to exercise `GET /`, so we override both
 * providers with lightweight stubs. This keeps the e2e suite runnable without a
 * live PostgreSQL database or Google OAuth credentials.
 *
 * Endpoints that actually need Prisma or Auth.js (`/me`, `/auth/*`) are
 * covered by unit tests with mocked dependencies (see
 * `src/auth/auth.controller.spec.ts` and `src/auth/auth.service.spec.ts`).
 */
describe('AppController (e2e)', () => {
  let app: INestApplication<App>

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ $connect: jest.fn(), $disconnect: jest.fn() })
      .overrideProvider(AuthBootstrap)
      .useValue({ onModuleInit: jest.fn() })
      .compile()

    app = moduleFixture.createNestApplication()
    configureOpenApi(app)
    await app.init()
  })

  afterEach(async () => {
    if (app) {
      await app.close()
    }
  })

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!')
  })

  it('/docs-json (GET) exposes the frontend API contract', async () => {
    const response = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200)
    const body = response.body as OpenApiDocument

    expect(body).toMatchObject({
      info: {
        title: 'Recipe Book API',
        version: '1.0',
      },
    })
    expect(body.paths).toHaveProperty('/recipes')
    expect(body.paths).toHaveProperty('/recipes/{id}')
    expect(body.paths).toHaveProperty('/me')

    expect(body.components?.securitySchemes).toMatchObject({
      'authjs-session': {
        type: 'apiKey',
        in: 'cookie',
        name: 'authjs.session-token',
      },
    })
    expect(body.components?.securitySchemes?.['authjs-session']).toHaveProperty(
      'description',
      expect.stringContaining('Auth.js session cookie'),
    )

    expect(body.paths['/recipes'].post.security).toEqual([
      { 'authjs-session': [] },
    ])
    expect(body.paths['/recipes'].get.security).toEqual([
      { 'authjs-session': [] },
    ])
    expect(body.paths['/recipes/{id}'].patch.security).toEqual([
      { 'authjs-session': [] },
    ])
    expect(body.paths['/me'].get.security).toEqual([{ 'authjs-session': [] }])

    expect(
      body.paths['/recipes'].post.requestBody?.content?.['application/json']
        ?.schema,
    ).toEqual(jsonSchemaRef('CreateRecipeDto'))
    expect(
      body.paths['/recipes/{id}'].patch.requestBody?.content?.[
        'application/json'
      ]?.schema,
    ).toEqual(jsonSchemaRef('UpdateRecipeDto'))
    expect(
      body.paths['/recipes'].post.responses?.['201']?.content?.[
        'application/json'
      ]?.schema,
    ).toEqual(jsonSchemaRef('RecipeResponseDto'))
    expect(
      body.paths['/recipes/{id}'].patch.responses?.['200']?.content?.[
        'application/json'
      ]?.schema,
    ).toEqual(jsonSchemaRef('RecipeResponseDto'))
    expect(
      body.paths['/recipes'].get.responses?.['200']?.content?.[
        'application/json'
      ]?.schema,
    ).toMatchObject({
      type: 'array',
      items: jsonSchemaRef('RecipeListItemDto'),
    })
    expect(
      body.paths['/me'].get.responses?.['200']?.content?.['application/json']
        ?.schema,
    ).toEqual(jsonSchemaRef('MeResponseDto'))

    expect(body.components?.schemas).toMatchObject({
      CreateRecipeDto: {
        required: expectArrayContaining(['title']),
        properties: {
          title: expectObjectContaining({ type: 'string', maxLength: 200 }),
          description: expectObjectContaining({
            type: 'string',
            maxLength: 2000,
            nullable: true,
          }),
          status: expectObjectContaining({
            enum: expectArrayContaining(['DRAFT', 'PRIVATE', 'PUBLIC']),
          }),
        },
      },
      UpdateRecipeDto: {
        properties: {
          description: expectObjectContaining({
            type: 'string',
            maxLength: 2000,
            nullable: true,
          }),
        },
      },
      RecipeResponseDto: {
        properties: {
          id: expectObjectContaining({ type: 'string' }),
          title: expectObjectContaining({ type: 'string' }),
          status: expectObjectContaining({
            enum: expectArrayContaining(['DRAFT', 'PRIVATE', 'PUBLIC']),
          }),
          updatedAt: expectObjectContaining({ format: 'date-time' }),
        },
      },
      MeResponseDto: {
        properties: {
          user: jsonSchemaRef('SessionUserDto'),
        },
      },
      SessionUserDto: {
        properties: {
          id: expectObjectContaining({ type: 'string' }),
          email: expectObjectContaining({ type: 'string', nullable: true }),
        },
      },
    })
  })
})
