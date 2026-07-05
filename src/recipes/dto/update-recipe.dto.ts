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
import { ApiPropertyOptional } from '@nestjs/swagger'
import { RecipeStatus } from '../../generated/prisma/enums'

export class UpdateRecipeDto {
  @ApiPropertyOptional({
    example: 'Updated pasta',
    maxLength: 200,
    description: 'Recipe title. When present, it cannot be empty.',
  })
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string

  @ApiPropertyOptional({
    example: 'Updated recipe notes.',
    type: String,
    maxLength: 2000,
    nullable: true,
    description: 'Recipe description. Send null to clear it.',
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
    nullable: true,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Matches(/\S/, { each: true })
  @MaxLength(40, { each: true })
  @ArrayMaxSize(20)
  tags?: string[] | null

  @ApiPropertyOptional({
    enum: RecipeStatus,
    description: 'Recipe visibility status.',
  })
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsEnum(RecipeStatus)
  status?: RecipeStatus
}
