import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { RecipeStatus } from '../../generated/prisma/enums'

export class UpdateRecipeDto {
  @ApiPropertyOptional({
    example: 'Updated pasta',
    maxLength: 200,
    description: 'Recipe title. When present, it cannot be empty.',
  })
  @IsOptional()
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
    enum: RecipeStatus,
    description: 'Recipe visibility status.',
  })
  @IsOptional()
  @IsEnum(RecipeStatus)
  status?: RecipeStatus
}
