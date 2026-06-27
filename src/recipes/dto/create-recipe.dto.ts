import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { RecipeStatus } from '../../generated/prisma/enums'

export class CreateRecipeDto {
  @ApiProperty({
    example: 'Pasta al pomodoro',
    maxLength: 200,
    description: 'Recipe title.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string

  @ApiPropertyOptional({
    example: 'Simple tomato pasta for weeknights.',
    type: String,
    maxLength: 2000,
    nullable: true,
    description: 'Optional recipe description.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null

  @ApiPropertyOptional({
    enum: RecipeStatus,
    default: RecipeStatus.DRAFT,
    description: 'Recipe visibility status. Defaults to DRAFT.',
  })
  @IsOptional()
  @IsEnum(RecipeStatus)
  status?: RecipeStatus
}
