import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { OAuthAuthorizeDto } from './dto/oauth-authorize.dto';
import { OAuthTokenDto } from './dto/oauth-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RefreshAuthGuard } from './guards/refresh-auth.guard';

@ApiTags('Autenticación')
@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('auth/register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registro de nuevo usuario' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Public()
  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Inicio de sesión' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Public()
  @Post('auth/refresh')
  @UseGuards(RefreshAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renovar access token usando refresh token' })
  async refresh(@CurrentUser() user: any) {
    return this.authService.refreshToken(user.refreshToken);
  }

  @Post('auth/logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cerrar sesión (revocar token)' })
  async logout(@Req() req: Request) {
    const token = req.headers.authorization?.replace('Bearer ', '') || '';
    return this.authService.logout(token);
  }

  @Public()
  @Post('oauth/authorize')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Iniciar flujo OAuth2 con PKCE - generar código de autorización',
    description: 'Este endpoint inicia el flujo OAuth2 Authorization Code con PKCE. El cliente (SPA) debe generar un code_verifier y code_challenge (S256) antes de llamar a este endpoint.',
  })
  async authorize(@Body() dto: OAuthAuthorizeDto) {
    return this.authService.authorize(
      dto.clientId,
      dto.redirectUri,
      dto.codeChallenge,
      dto.codeChallengeMethod || 'S256',
      dto.state,
    );
  }

  @Public()
  @Post('oauth/token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Intercambiar código de autorización por tokens',
    description: 'Este endpoint intercambia el código de autorización (obtenido de /oauth/authorize) por un access token y refresh token. El cliente debe enviar el code_verifier original para verificación PKCE.',
  })
  async token(@Body() dto: OAuthTokenDto) {
    if (dto.grantType === 'refresh_token') {
      return this.authService.refreshToken(dto.refreshToken || '');
    }
    return this.authService.exchangeCodeForToken(
      dto.code || '',
      dto.codeVerifier || '',
      dto.clientId,
      dto.redirectUri,
    );
  }

  @Public()
  @Post('auth/forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Solicitar reseteo de contraseña' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Public()
  @Post('auth/reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resetear contraseña con token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }

  @Public()
  @Post('auth/verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verificar email con token' })
  async verifyEmail(@Body('token') token: string) {
    return this.authService.verifyEmail(token);
  }
}
