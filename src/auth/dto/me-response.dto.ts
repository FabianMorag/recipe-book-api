import { ApiProperty } from '@nestjs/swagger'

export class SessionUserDto {
  @ApiProperty({ example: 'user_123' })
  id!: string

  @ApiProperty({ example: 'Ada Lovelace', type: String, nullable: true })
  name!: string | null

  @ApiProperty({ example: 'ada@example.com', type: String, nullable: true })
  email!: string | null

  @ApiProperty({
    example: 'https://lh3.googleusercontent.com/a/example',
    type: String,
    nullable: true,
  })
  image!: string | null
}

export class MeResponseDto {
  @ApiProperty({ type: SessionUserDto })
  user!: SessionUserDto
}
