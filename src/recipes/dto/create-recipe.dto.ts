import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  ValidateIf,
  MaxLength,
  Min,
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
    example: 4,
    type: Number,
    description: 'Number of servings. Positive integer.',
    minimum: 1,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  servings?: number | null

  @ApiPropertyOptional({
    example: 'https://example.com/pasta.jpg',
    type: String,
    description: 'URL to a recipe image.',
    maxLength: 2048,
    nullable: true,
  })
  @IsOptional()
  @IsUrl()
  @MaxLength(2048)
  imageUrl?: string | null

  @ApiPropertyOptional({
    example: ['italian', 'quick'],
    description: 'Tags for display and future filtering.',
    type: [String],
  })
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsArray()
  @IsString({ each: true })
  @Matches(/\S/, { each: true })
  @MaxLength(40, { each: true })
  @ArrayMaxSize(20)
  tags?: string[]

  @ApiPropertyOptional({
    enum: RecipeStatus,
    default: RecipeStatus.DRAFT,
    description: 'Recipe visibility status. Defaults to DRAFT.',
  })
  @IsOptional()
  @IsEnum(RecipeStatus)
  status?: RecipeStatus
}
