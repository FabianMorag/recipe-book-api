import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { RecipeStatus } from '../generated/prisma/enums'
import { PrismaService } from '../prisma/prisma.service'
import { CreateRecipeDto } from './dto/create-recipe.dto'
import { UpdateRecipeDto } from './dto/update-recipe.dto'

export type RecipeAuthor = {
  id: string
  name: string | null
  image: string | null
}

export type RecipeListItem = {
  id: string
  title: string
  description: string | null
  servings: number | null
  imageUrl: string | null
  tags: string[]
  status: RecipeStatus
  author: RecipeAuthor
  createdAt: Date
}

export type RecipeResponse = RecipeListItem & {
  updatedAt: Date
}

type RecipeRecord = RecipeResponse & {
  authorId: string
}

@Injectable()
export class RecipesService {
  static readonly authorSelect = {
    id: true,
    name: true,
    image: true,
  } as const

  static readonly listSelect = {
    id: true,
    title: true,
    description: true,
    servings: true,
    imageUrl: true,
    tags: true,
    status: true,
    createdAt: true,
    author: { select: RecipesService.authorSelect },
  } as const

  static readonly detailSelect = {
    ...RecipesService.listSelect,
    updatedAt: true,
    authorId: true,
  } as const

  constructor(private readonly prisma: PrismaService) {}

  async create(ownerId: string, dto: CreateRecipeDto): Promise<RecipeResponse> {
    this.assertValidStatus(dto.status)

    const recipe = await this.prisma.recipe.create({
      data: {
        title: dto.title,
        description: dto.description ?? null,
        servings: dto.servings ?? null,
        imageUrl: dto.imageUrl ?? null,
        tags: dto.tags ?? [],
        status: dto.status ?? RecipeStatus.DRAFT,
        authorId: ownerId,
      },
      select: RecipesService.detailSelect,
    })

    return this.toRecipeResponse(recipe)
  }

  async findAllByOwner(ownerId: string): Promise<RecipeListItem[]> {
    const recipes = await this.prisma.recipe.findMany({
      where: { authorId: ownerId },
      orderBy: { createdAt: 'desc' },
      select: RecipesService.listSelect,
    })

    return recipes.map((recipe) => this.toRecipeListItem(recipe))
  }

  async findAllPublic(): Promise<RecipeListItem[]> {
    const recipes = await this.prisma.recipe.findMany({
      where: { status: RecipeStatus.PUBLIC },
      orderBy: { createdAt: 'desc' },
      select: RecipesService.listSelect,
    })

    return recipes.map((recipe) => this.toRecipeListItem(recipe))
  }

  async findOneOrNotFound(
    id: string,
    requesterId: string | null,
  ): Promise<RecipeResponse> {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id },
      select: RecipesService.detailSelect,
    })

    if (!recipe || !this.canRead(recipe, requesterId)) {
      throw new NotFoundException('Recipe not found')
    }

    return this.toRecipeResponse(recipe)
  }

  async update(
    id: string,
    ownerId: string,
    dto: UpdateRecipeDto,
  ): Promise<RecipeResponse> {
    this.assertValidStatus(dto.status)

    const existing = await this.prisma.recipe.findFirst({
      where: { id, authorId: ownerId },
      select: { id: true },
    })

    if (!existing) {
      throw new NotFoundException('Recipe not found')
    }

    const data = this.toUpdateData(dto)
    const recipe = await this.prisma.recipe.update({
      where: { id },
      data,
      select: RecipesService.detailSelect,
    })

    return this.toRecipeResponse(recipe)
  }

  private canRead(
    recipe: Pick<RecipeRecord, 'authorId' | 'status'>,
    requesterId: string | null,
  ): boolean {
    return (
      recipe.status === RecipeStatus.PUBLIC || recipe.authorId === requesterId
    )
  }

  private assertValidStatus(status: RecipeStatus | undefined): void {
    if (!status) {
      return
    }
    const statuses: string[] = Object.values(RecipeStatus)
    if (!statuses.includes(status)) {
      throw new BadRequestException('Invalid recipe status')
    }
  }

  private toUpdateData(dto: UpdateRecipeDto): {
    title?: string
    description?: string | null
    servings?: number | null
    imageUrl?: string | null
    tags?: string[]
    status?: RecipeStatus
  } {
    const data: {
      title?: string
      description?: string | null
      servings?: number | null
      imageUrl?: string | null
      tags?: string[]
      status?: RecipeStatus
    } = {}

    if (dto.title !== undefined) {
      data.title = dto.title
    }
    if (dto.description !== undefined) {
      data.description = dto.description
    }
    if (dto.servings !== undefined) {
      data.servings = dto.servings
    }
    if (dto.imageUrl !== undefined) {
      data.imageUrl = dto.imageUrl
    }
    if (dto.tags !== undefined) {
      data.tags = dto.tags ?? []
    }
    if (dto.status !== undefined) {
      data.status = dto.status
    }

    return data
  }

  private toRecipeListItem(recipe: RecipeListItem): RecipeListItem {
    return {
      id: recipe.id,
      title: recipe.title,
      description: recipe.description,
      servings: recipe.servings,
      imageUrl: recipe.imageUrl,
      tags: recipe.tags ?? [],
      status: recipe.status,
      author: recipe.author,
      createdAt: recipe.createdAt,
    }
  }

  private toRecipeResponse(recipe: RecipeResponse): RecipeResponse {
    return {
      ...this.toRecipeListItem(recipe),
      updatedAt: recipe.updatedAt,
    }
  }
}
