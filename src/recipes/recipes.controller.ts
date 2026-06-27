import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common'
import type { Request } from 'express'
import type { Session } from '../auth/auth-loader'
import { AuthService } from '../auth/auth.service'
import { CreateRecipeDto } from './dto/create-recipe.dto'
import { UpdateRecipeDto } from './dto/update-recipe.dto'
import {
  RecipeListItem,
  RecipeResponse,
  RecipesService,
} from './recipes.service'

@Controller('recipes')
export class RecipesController {
  constructor(
    private readonly recipesService: RecipesService,
    private readonly authService: AuthService,
  ) {}

  @Post()
  async create(
    @Req() req: Request,
    @Body() dto: CreateRecipeDto,
  ): Promise<RecipeResponse> {
    const userId = await this.requireUserId(req)
    return this.recipesService.create(userId, dto)
  }

  @Get()
  async findMine(@Req() req: Request): Promise<RecipeListItem[]> {
    const userId = await this.requireUserId(req)
    return this.recipesService.findAllByOwner(userId)
  }

  @Get('public')
  async findPublic(): Promise<RecipeListItem[]> {
    return this.recipesService.findAllPublic()
  }

  @Get(':id')
  async findOne(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<RecipeResponse> {
    const userId = await this.optionalUserId(req)
    return this.recipesService.findOneOrNotFound(id, userId)
  }

  @Patch(':id')
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateRecipeDto,
  ): Promise<RecipeResponse> {
    const userId = await this.requireUserId(req)
    return this.recipesService.update(id, userId, dto)
  }

  private async requireUserId(req: Request): Promise<string> {
    const userId = await this.optionalUserId(req)
    if (!userId) {
      throw new UnauthorizedException('Not authenticated')
    }
    return userId
  }

  private async optionalUserId(req: Request): Promise<string | null> {
    const session: Session | null = await this.authService.getSession(req)
    return session?.user?.id ?? null
  }
}
