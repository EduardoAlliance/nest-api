import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OAuthTokenDto {
  @ApiProperty({ description: 'Tipo de grant: authorization_code o refresh_token' })
  @IsString()
  grantType: string;

  @ApiPropertyOptional({ description: 'Código de autorización (para authorization_code)' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ description: 'Code verifier generado por el cliente (PKCE)' })
  @IsOptional()
  @IsString()
  codeVerifier?: string;

  @ApiPropertyOptional({ description: 'Refresh token (para refresh_token grant)' })
  @IsOptional()
  @IsString()
  refreshToken?: string;

  @ApiProperty({ description: 'URL de redirección registrada' })
  @IsString()
  redirectUri: string;

  @ApiProperty({ description: 'ID del cliente OAuth' })
  @IsString()
  clientId: string;
}

export class OAuthTokenResponseDto {
  @ApiProperty({ description: 'Access token JWT' })
  accessToken: string;

  @ApiProperty({ description: 'Refresh token' })
  refreshToken: string;

  @ApiProperty({ description: 'Tipo de token', example: 'Bearer' })
  tokenType: string;

  @ApiProperty({ description: 'Tiempo de expiración en segundos' })
  expiresIn: number;
}
