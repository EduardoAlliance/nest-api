import { IsString, IsOptional, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class OAuthAuthorizeDto {
  @ApiProperty({ description: 'ID del cliente OAuth' })
  @IsString()
  clientId: string;

  @ApiProperty({ description: 'URL de redirección registrada' })
  @IsUrl()
  redirectUri: string;

  @ApiProperty({ description: 'Tipo de respuesta: code' })
  @IsString()
  responseType: string;

  @ApiProperty({ description: 'Code challenge generado por el cliente (PKCE)' })
  @IsString()
  codeChallenge: string;

  @ApiProperty({ description: 'Método del code challenge: S256 o plain' })
  @IsString()
  @IsOptional()
  codeChallengeMethod?: string;

  @ApiProperty({ description: 'Estado para verificar la integridad de la solicitud' })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiProperty({ description: 'Scope solicitado' })
  @IsString()
  @IsOptional()
  scope?: string;
}

export class OAuthAuthorizeResponseDto {
  @ApiProperty({ description: 'Código de autorización temporal' })
  code: string;

  @ApiProperty({ description: 'Estado devuelto para verificación' })
  @IsOptional()
  state?: string;
}
