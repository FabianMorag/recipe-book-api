import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types'
import { AppModule } from './../src/app.module'
import { PrismaService } from './../src/prisma/prisma.service'
import { AuthBootstrap } from './../src/auth/auth.bootstrap'

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
})
