import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'

/**
 * Wraps the generated Prisma client as a NestJS injectable.
 *
 * Prisma 7 requires a driver adapter (or `accelerateUrl`) to boot the client.
 * We instantiate `PrismaPg` with the `DATABASE_URL` connection string and pass
 * it to `super({ adapter })`. `@prisma/adapter-pg` bundles `pg`, so no extra
 * driver package is needed.
 *
 * The service extends {@link PrismaClient} so it can be passed directly to the
 * Auth.js Prisma adapter (which expects a PrismaClient instance) and to any
 * feature service that needs data access.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const connectionString = process.env['DATABASE_URL']
    if (!connectionString) {
      throw new Error(
        'DATABASE_URL environment variable is required to start PrismaService.',
      )
    }
    const adapter = new PrismaPg({ connectionString })
    super({ adapter })
  }

  async onModuleInit(): Promise<void> {
    await this.$connect()
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect()
  }
}
