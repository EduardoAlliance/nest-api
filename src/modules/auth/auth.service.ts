import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '@nestjs-modules/mailer';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from '../common/interfaces/api-response.interface';
import { LoggerService } from '../../logging/logger.service';

const REFRESH_GRACE_MS = 30_000;
const GENERIC_RECOVERY_MESSAGE =
  'Si el email existe, recibirás instrucciones para resetear tu contraseña';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
    private readonly mailerService: MailerService,
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
    await this.usersService.setEmailVerificationToken(
      user.id,
      emailVerificationToken,
    );
    await this.sendVerificationEmail(user, emailVerificationToken);

    this.logger.log(`Usuario registrado: ${user.email}`);

    return {
      user: this.toPublicUser(user),
      message: 'Usuario registrado exitosamente. Verifica tu email.',
    };
  }

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByEmailWithPassword(
      loginDto.email,
    );
    if (!user) {
      this.logger.warn(
        `Intento de login fallido - email no encontrado: ${loginDto.email}`,
      );
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (user.deletedAt) {
      this.logger.warn(
        `Intento de login - usuario eliminado: ${loginDto.email}`,
      );
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!user.isActive) {
      this.logger.warn(
        `Intento de login - usuario inactivo: ${loginDto.email}`,
      );
      throw new UnauthorizedException('La cuenta está desactivada');
    }

    const isPasswordValid = await user.validatePassword(loginDto.password);
    if (!isPasswordValid) {
      this.logger.warn(
        `Intento de login fallido - contraseña incorrecta: ${loginDto.email}`,
      );
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const tokens = await this.generateTokens(user);
    await this.usersService.setRefreshToken(
      user.id,
      this.hashToken(tokens.refreshToken),
      null,
      null,
    );

    this.logger.log(`Login exitoso: ${user.email}`);

    return { ...tokens, user: this.toPublicUser(user) };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.refreshSecret(),
      });

      const user = await this.usersService.findByIdWithRefreshToken(
        payload.sub,
      );
      if (!user || !user.isActive) {
        throw new UnauthorizedException('Usuario no encontrado o inactivo');
      }

      const tokenHash = this.hashToken(refreshToken);
      const isCurrentToken = this.hashesMatch(user.refreshTokenHash, tokenHash);
      const isPreviousTokenWithinGrace =
        this.hashesMatch(user.previousRefreshTokenHash, tokenHash) &&
        this.isWithinGrace(user.refreshTokenRotatedAt);

      if (!isCurrentToken && !isPreviousTokenWithinGrace) {
        throw new UnauthorizedException('Refresh token inválido o expirado');
      }

      const tokens = await this.generateTokens(user);

      // Si se usó el token anterior dentro de la ventana de gracia, se
      // consume y no se vuelve a habilitar: evita reutilizaciones en cadena.
      const previousTokenHash = isCurrentToken ? tokenHash : null;

      await this.usersService.setRefreshToken(
        user.id,
        this.hashToken(tokens.refreshToken),
        previousTokenHash,
        new Date(),
      );

      return { ...tokens, user: this.toPublicUser(user) };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }
  }

  async logout(refreshToken?: string) {
    if (refreshToken) {
      try {
        const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
          secret: this.refreshSecret(),
        });
        const user = await this.usersService.findByIdWithRefreshToken(
          payload.sub,
        );

        if (user) {
          const tokenHash = this.hashToken(refreshToken);
          const matchesCurrent = this.hashesMatch(
            user.refreshTokenHash,
            tokenHash,
          );
          const matchesPrevious = this.hashesMatch(
            user.previousRefreshTokenHash,
            tokenHash,
          );

          if (matchesCurrent || matchesPrevious) {
            await this.usersService.clearRefreshToken(user.id);
          }
        }
      } catch {
        // Token expirado o inválido: no hay sesión que revocar.
      }
    }

    this.logger.log('Sesión cerrada exitosamente');
    return { message: 'Sesión cerrada exitosamente' };
  }

  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      return { message: GENERIC_RECOVERY_MESSAGE };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000);

    await this.usersService.setPasswordResetToken(
      user.id,
      resetToken,
      resetExpires,
    );
    await this.sendPasswordResetEmail(user, resetToken);

    this.logger.log(`Solicitud de reseteo de contraseña: ${email}`);

    return { message: GENERIC_RECOVERY_MESSAGE };
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.usersService.findByPasswordResetToken(token);
    if (!user) {
      throw new BadRequestException('Token inválido o expirado');
    }

    await this.usersService.update(user.id, {
      password: newPassword,
    });
    await this.usersService.clearPasswordResetToken(user.id);
    await this.usersService.clearRefreshToken(user.id);

    this.logger.log(`Contraseña reseteada exitosamente: ${user.email}`);

    return { message: 'Contraseña actualizada exitosamente' };
  }

  async verifyEmail(token: string) {
    const user = await this.usersService.findByEmailVerificationToken(token);
    if (!user) {
      throw new BadRequestException('Token de verificación inválido');
    }

    await this.usersService.markEmailVerified(user.id);
    await this.usersService.clearEmailVerificationToken(user.id);

    this.logger.log(`Email verificado: ${user.email}`);

    return { message: 'Email verificado exitosamente' };
  }

  private async generateTokens(user: User): Promise<TokenPair> {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessExpiresIn =
      this.configService.get<string>('jwt.expiresIn') || '15m';
    const refreshExpiresIn =
      this.configService.get<string>('jwt.refreshExpiresIn') || '7d';

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        payload as any,
        {
          secret: this.accessSecret(),
          expiresIn: accessExpiresIn,
        } as any,
      ),
      this.jwtService.signAsync(
        payload as any,
        {
          secret: this.refreshSecret(),
          expiresIn: refreshExpiresIn,
        } as any,
      ),
    ]);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.parseDuration(accessExpiresIn),
    };
  }

  private accessSecret(): string {
    return this.configService.get<string>('jwt.secret') || 'default-secret';
  }

  private refreshSecret(): string {
    return (
      this.configService.get<string>('jwt.refreshSecret') ||
      'default-refresh-secret'
    );
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private hashesMatch(
    storedHash: string | null | undefined,
    tokenHash: string,
  ): boolean {
    if (!storedHash) {
      return false;
    }

    const stored = Buffer.from(storedHash, 'hex');
    const computed = Buffer.from(tokenHash, 'hex');

    return (
      stored.length === computed.length &&
      crypto.timingSafeEqual(stored, computed)
    );
  }

  private isWithinGrace(rotatedAt: Date | null | undefined): boolean {
    if (!rotatedAt) {
      return false;
    }
    return Date.now() - new Date(rotatedAt).getTime() <= REFRESH_GRACE_MS;
  }

  private parseDuration(value: string): number {
    const match = /^(\d+)([smhd])?$/i.exec(value.trim());
    if (!match) {
      return 900;
    }

    const amount = parseInt(match[1], 10);
    const unit = (match[2] || 's').toLowerCase();
    const multipliers: Record<string, number> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };

    return amount * (multipliers[unit] || 1);
  }

  private toPublicUser(
    user: Pick<
      User,
      'id' | 'email' | 'name' | 'phone' | 'role' | 'emailVerified'
    >,
  ) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      emailVerified: user.emailVerified,
    };
  }

  private async sendVerificationEmail(
    user: Pick<User, 'email' | 'name'>,
    token: string,
  ): Promise<void> {
    const link = `${this.frontendUrl()}/verify-email?token=${encodeURIComponent(token)}`;

    try {
      await this.mailerService.sendMail({
        to: user.email,
        subject: 'Verifica tu correo',
        html: `
          <p>Hola ${this.escapeHtml(user.name)},</p>
          <p>Gracias por registrarte. Confirma tu cuenta haciendo clic en el siguiente enlace:</p>
          <p><a href="${link}">Verificar mi correo</a></p>
          <p>Si no solicitaste este registro, puedes ignorar este mensaje.</p>
        `,
      });
    } catch (error) {
      this.logger.warn(
        `No se pudo enviar el correo de verificación a ${user.email}: ${
          (error as Error).message
        }`,
      );
    }
  }

  private async sendPasswordResetEmail(
    user: Pick<User, 'email' | 'name'>,
    token: string,
  ): Promise<void> {
    const link = `${this.frontendUrl()}/reset-password?token=${encodeURIComponent(token)}`;

    try {
      await this.mailerService.sendMail({
        to: user.email,
        subject: 'Restablece tu contraseña',
        html: `
          <p>Hola ${this.escapeHtml(user.name)},</p>
          <p>Recibimos una solicitud para restablecer tu contraseña. Haz clic en el siguiente enlace:</p>
          <p><a href="${link}">Restablecer contraseña</a></p>
          <p>El enlace expira en 1 hora. Si no solicitaste este cambio, puedes ignorar este mensaje.</p>
        `,
      });
    } catch (error) {
      this.logger.warn(
        `No se pudo enviar el correo de reseteo a ${user.email}: ${
          (error as Error).message
        }`,
      );
    }
  }

  private frontendUrl(): string {
    const url =
      this.configService.get<string>('app.frontendUrl') ||
      'http://localhost:3001';
    return url.replace(/\/+$/, '');
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
