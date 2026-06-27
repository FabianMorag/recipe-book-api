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
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'
import type { Request } from 'express'
import type { Session } from '../auth/auth-loader'
import { AuthService } from '../auth/auth.service'
import { CreateRecipeDto } from './dto/create-recipe.dto'
import { RecipeListItemDto, RecipeResponseDto } from './dto/recipe-response.dto'
import { UpdateRecipeDto } from './dto/update-recipe.dto'
import {
  RecipeListItem,
  RecipeResponse,
  RecipesService,
} from './recipes.service'

@ApiTags('recipes')
@Controller('recipes')
export class RecipesController {
  constructor(
    private readonly recipesService: RecipesService,
    private readonly authService: AuthService,
  ) {}

  @Post()
  @ApiSecurity('authjs-session')
  @ApiOperation({ summary: 'Create a recipe owned by the authenticated user' })
  @ApiBody({ type: CreateRecipeDto })
  @ApiCreatedResponse({ type: RecipeResponseDto })
  @ApiBadRequestResponse({ description: 'Request body failed validation.' })
  @ApiUnauthorizedResponse({ description: 'No valid session cookie was sent.' })
  async create(
    @Req() req: Request,
    @Body() dto: CreateRecipeDto,
  ): Promise<RecipeResponse> {
    const userId = await this.requireUserId(req)
    return this.recipesService.create(userId, dto)
  }

  @Get()
  @ApiSecurity('authjs-session')
  @ApiOperation({ summary: 'List recipes owned by the authenticated user' })
  @ApiOkResponse({ type: RecipeListItemDto, isArray: true })
  @ApiUnauthorizedResponse({ description: 'No valid session cookie was sent.' })
  async findMine(@Req() req: Request): Promise<RecipeListItem[]> {
    const userId = await this.requireUserId(req)
    return this.recipesService.findAllByOwner(userId)
  }

  @Get('public')
  @ApiOperation({ summary: 'List public recipes' })
  @ApiOkResponse({ type: RecipeListItemDto, isArray: true })
  async findPublic(): Promise<RecipeListItem[]> {
    return this.recipesService.findAllPublic()
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a recipe by id when visible to the requester' })
  @ApiParam({ name: 'id', example: 'recipe_123' })
  @ApiOkResponse({ type: RecipeResponseDto })
  @ApiNotFoundResponse({ description: 'Recipe not found or not visible.' })
  async findOne(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<RecipeResponse> {
    const userId = await this.optionalUserId(req)
    return this.recipesService.findOneOrNotFound(id, userId)
  }

  @Patch(':id')
  @ApiSecurity('authjs-session')
  @ApiOperation({ summary: 'Update a recipe owned by the authenticated user' })
  @ApiParam({ name: 'id', example: 'recipe_123' })
  @ApiBody({ type: UpdateRecipeDto })
  @ApiOkResponse({ type: RecipeResponseDto })
  @ApiBadRequestResponse({ description: 'Request body failed validation.' })
  @ApiUnauthorizedResponse({ description: 'No valid session cookie was sent.' })
  @ApiNotFoundResponse({ description: 'Recipe not found for this owner.' })
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
