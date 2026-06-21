import { Global, Module } from '@nestjs/common'
import { PrismaService } from './prisma.service'

/**
 * Global module so every feature module can inject {@link PrismaService}
 * without re-importing it everywhere.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
