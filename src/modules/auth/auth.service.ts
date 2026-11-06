import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { LoggerService } from '../../logging/logger.service';

@Injectable()
export class AuthService {
  private revokedTokens: Set<string> = new Set();

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {}

  async register(registerDto: RegisterDto) {
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException('El email ya está registrado');
    }

    const user = await this.usersService.create({
      email: registerDto.email,
      name: registerDto.name,
      password: registerDto.password,
    });

    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    user.emailVerificationToken = emailVerificationToken;
    await this.usersService.update(user.id, { emailVerificationToken } as any);

    this.logger.log(`Usuario registrado: ${user.email}`);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      message: 'Usuario registrado exitosamente. Verifica tu email.',
    };
  }

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByEmailWithPassword(loginDto.email);
    if (!user) {
      this.logger.warn(`Intento de login fallido - email no encontrado: ${loginDto.email}`);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!user.isActive) {
      this.logger.warn(`Intento de login - usuario inactivo: ${loginDto.email}`);
      throw new UnauthorizedException('La cuenta está desactivada');
    }

    const isPasswordValid = await user.validatePassword(loginDto.password);
    if (!isPasswordValid) {
      this.logger.warn(`Intento de login fallido - contraseña incorrecta: ${loginDto.email}`);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const tokens = await this.generateTokens(user);

    this.logger.log(`Login exitoso: ${user.email}`);

    return tokens;
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });

      const user = await this.usersService.findById(payload.sub);
      if (!user || !user.isActive) {
        throw new UnauthorizedException('Usuario no encontrado o inactivo');
      }

      return this.generateTokens(user);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }
  }

  async authorize(clientId: string, redirectUri: string, codeChallenge: string, codeChallengeMethod: string, state?: string) {
    const authorizationCode = uuidv4();

    const codeData = {
      clientId,
      redirectUri,
      codeChallenge,
      codeChallengeMethod: codeChallengeMethod || 'S256',
      state,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    };

    return { code: authorizationCode, state };
  }

  async exchangeCodeForToken(
    code: string,
    codeVerifier: string,
    clientId: string,
    redirectUri: string,
  ) {
    // In a real implementation, look up the stored authorization code
    // and verify the code verifier against the stored code challenge
    const codeChallenge = this.generateCodeChallenge(codeVerifier);

    // Validate the code verifier (S256 method)
    if (!this.verifyCodeChallenge(codeChallenge, codeVerifier)) {
      throw new BadRequestException('Code verifier inválido');
    }

    // In a real implementation, get the user associated with the authorization code
    // For now, this would require the user to be authenticated and associated with the code
    throw new BadRequestException(
      'Implementación completa requiere almacenamiento de códigos de autorización',
    );
  }

  private generateCodeChallenge(verifier: string): string {
    const hash = crypto.createHash('sha256').update(verifier).digest('base64');
    return hash
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  private verifyCodeChallenge(storedChallenge: string, verifier: string): boolean {
    const computedChallenge = this.generateCodeChallenge(verifier);
    return storedChallenge === computedChallenge;
  }

  private async generateTokens(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };

    const secret = this.configService.get<string>('jwt.secret') || 'default-secret';
    const refreshSecret = this.configService.get<string>('jwt.refreshSecret') || 'default-refresh-secret';
    const expiresIn = this.configService.get<string>('jwt.expiresIn') || '1h';
    const refreshExpiresIn = this.configService.get<string>('jwt.refreshExpiresIn') || '7d';

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload as any, {
        secret,
        expiresIn,
      } as any),
      this.jwtService.signAsync(payload as any, {
        secret: refreshSecret,
        expiresIn: refreshExpiresIn,
      } as any),
    ]);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: 3600,
    };
  }

  async logout(accessToken: string) {
    this.revokedTokens.add(accessToken);
    this.logger.log('Sesión cerrada exitosamente');
    return { message: 'Sesión cerrada exitosamente' };
  }

  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      return { message: 'Si el email existe, recibirás instrucciones para resetear tu contraseña' };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000);

    user.passwordResetToken = resetToken;
    user.passwordResetExpires = resetExpires;
    await this.usersService.update(user.id, {
      passwordResetToken: resetToken,
      passwordResetExpires: resetExpires,
    } as any);

    this.logger.log(`Solicitud de reseteo de contraseña: ${email}`);

    return { message: 'Si el email existe, recibirás instrucciones para resetear tu contraseña' };
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.usersService.findByEmailWithPassword('');

    const users = await this.usersService.findAll({ page: 1, limit: 100 });
    const foundUser = users.data.find(
      (u) => u.passwordResetToken === token && u.passwordResetExpires > new Date(),
    );

    if (!foundUser) {
      throw new BadRequestException('Token inválido o expirado');
    }

    const updateDto: any = {
      password: newPassword,
      passwordResetToken: null,
      passwordResetExpires: null,
    };

    await this.usersService.update(foundUser.id, updateDto);

    this.logger.log(`Contraseña reseteada exitosamente: ${foundUser.email}`);

    return { message: 'Contraseña actualizada exitosamente' };
  }

  async verifyEmail(token: string) {
    const users = await this.usersService.findAll({ page: 1, limit: 100 });
    const user = users.data.find((u) => u.emailVerificationToken === token);

    if (!user) {
      throw new BadRequestException('Token de verificación inválido');
    }

    await this.usersService.update(user.id, {
      emailVerified: true,
      emailVerificationToken: null,
    } as any);

    this.logger.log(`Email verificado: ${user.email}`);

    return { message: 'Email verificado exitosamente' };
  }
}
