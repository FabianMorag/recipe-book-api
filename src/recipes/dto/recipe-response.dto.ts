import { ApiProperty } from '@nestjs/swagger'
import { RecipeStatus } from '../../generated/prisma/enums'

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

  @ApiProperty({ example: '2026-06-27T10:00:00.000Z', format: 'date-time' })
  createdAt!: Date
}

export class RecipeResponseDto extends RecipeListItemDto {
  @ApiProperty({ example: '2026-06-27T10:00:00.000Z', format: 'date-time' })
  updatedAt!: Date
}
