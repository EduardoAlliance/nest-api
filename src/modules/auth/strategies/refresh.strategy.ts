import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { JwtPayload } from '../../common/interfaces/api-response.interface';

@Injectable()
export class RefreshStrategy extends PassportStrategy(Strategy, 'refresh') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => {
          const refreshToken = req?.cookies?.refreshToken;
          if (!refreshToken) {
            const authHeader = req?.headers?.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
              return authHeader.substring(7);
            }
            return null;
          }
          return refreshToken;
        },
        ExtractJwt.fromBodyField('refreshToken'),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.refreshSecret') || 'default-refresh-secret',
      passReqToCallback: true,
    } as any);
  }

  async validate(req: Request, payload: JwtPayload) {
    const refreshToken =
      req?.cookies?.refreshToken ||
      req?.body?.refreshToken ||
      req?.headers?.authorization?.substring(7);

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token no proporcionado');
    }

    return {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      refreshToken,
    };
  }
}
