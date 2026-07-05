import { ApiProperty } from '@nestjs/swagger'
import { RecipeStatus } from '../../generated/prisma/enums'

export class RecipeAuthorDto {
  @ApiProperty({ example: 'user_abc123' })
  id!: string

  @ApiProperty({ example: 'Alice', nullable: true, type: String })
  name!: string | null

  @ApiProperty({
    example: 'https://example.com/alice.jpg',
    nullable: true,
    type: String,
  })
  image!: string | null
}

export class RecipeListItemDto {
  @ApiProperty({ example: 'recipe_123' })
  id!: string

  @ApiProperty({ example: 'Pasta al pomodoro', maxLength: 200 })
  title!: string

  @ApiProperty({
    example: 'Simple tomato pasta for weeknights.',
    type: String,
    maxLength: 2000,
    nullable: true,
  })
  description!: string | null

  @ApiProperty({ enum: RecipeStatus, example: RecipeStatus.DRAFT })
  status!: RecipeStatus

  @ApiProperty({ example: 4, nullable: true, type: Number })
  servings!: number | null

  @ApiProperty({
    example: 'https://example.com/pasta.jpg',
    nullable: true,
    type: String,
  })
  imageUrl!: string | null

  @ApiProperty({ example: ['italian', 'quick'], type: [String] })
  tags!: string[]

  @ApiProperty({ type: RecipeAuthorDto })
  author!: RecipeAuthorDto

  @ApiProperty({ example: '2026-06-27T10:00:00.000Z', format: 'date-time' })
  createdAt!: Date
}

export class RecipeResponseDto extends RecipeListItemDto {
  @ApiProperty({ example: '2026-06-27T10:00:00.000Z', format: 'date-time' })
  updatedAt!: Date
}
