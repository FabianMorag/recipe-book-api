import { Controller, Get, Req, UnauthorizedException } from '@nestjs/common'
import {
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'
import type { Request } from 'express'
import { AuthService } from './auth.service'
import type { Session } from './auth-loader'
import { MeResponseDto } from './dto/me-response.dto'

/**
 * Identity endpoint for the backend-owned session.
 *
 * A separate frontend can redirect the browser to `/auth/signin/google` to
 * establish a session cookie, then call `GET /me` to read the authenticated
 * user.
 */
@ApiTags('auth')
@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @ApiSecurity('authjs-session')
  @ApiOperation({ summary: 'Get the authenticated session user' })
  @ApiOkResponse({ type: MeResponseDto })
  @ApiUnauthorizedResponse({ description: 'No valid session cookie was sent.' })
  async getMe(
    @Req() req: Request,
  ): Promise<{ user: NonNullable<Session['user']> }> {
    const session = await this.authService.getSession(req)
    if (!session?.user) {
      throw new UnauthorizedException('Not authenticated')
    }
    return { user: session.user }
  }
}
