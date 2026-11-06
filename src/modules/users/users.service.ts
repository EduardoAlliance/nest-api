import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Repository } from 'typeorm';
import type { Cache } from 'cache-manager';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { QueryUserDto } from './dto/query-user.dto';

const CACHE_USERS_LIST = '/api/v1/users';

export type SafeUser = Pick<
  User,
  | 'id'
  | 'email'
  | 'name'
  | 'phone'
  | 'role'
  | 'isActive'
  | 'emailVerified'
  | 'createdAt'
  | 'updatedAt'
>;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<SafeUser> {
    const existingUser = await this.usersRepository.findOne({
      where: { email: createUserDto.email },
      withDeleted: true,
    });
    if (existingUser) {
      throw new ConflictException('El email ya está registrado');
    }

    const user = this.usersRepository.create(createUserDto);
    const saved = await this.usersRepository.save(user);
    await this.cacheManager.del(CACHE_USERS_LIST);
    return this.toSafeUser(saved);
  }

  async findAll(
    queryDto: QueryUserDto,
  ): Promise<{ data: User[]; total: number; page: number; limit: number }> {
    const page = queryDto.page || 1;
    const limit = queryDto.limit || 10;
    const skip = (page - 1) * limit;

    const queryBuilder = this.usersRepository.createQueryBuilder('user');

    if (queryDto.search) {
      queryBuilder.where(
        '(user.name LIKE :search OR user.email LIKE :search)',
        {
          search: `%${queryDto.search}%`,
        },
      );
    }

    if (queryDto.role) {
      queryBuilder.andWhere('user.role = :role', { role: queryDto.role });
    }

    if (queryDto.isActive !== undefined) {
      queryBuilder.andWhere('user.isActive = :isActive', {
        isActive: queryDto.isActive,
      });
    }

    const [data, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .orderBy('user.createdAt', 'DESC')
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async findById(id: number): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
      withDeleted: true,
    });
    if (!user) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }
    return user;
  }

  async findActiveById(id: number): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { id, isActive: true },
    });
  }

  async findByIdWithPassword(id: number): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.id = :id', { id })
      .getOne();
  }

  async findByIdWithRefreshToken(id: number): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect([
        'user.refreshTokenHash',
        'user.previousRefreshTokenHash',
        'user.refreshTokenRotatedAt',
      ])
      .where('user.id = :id', { id })
      .getOne();
  }

  async findByPasswordResetToken(token: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect(['user.passwordResetToken', 'user.passwordResetExpires'])
      .where('user.passwordResetToken = :token', { token })
      .andWhere('user.passwordResetExpires > :now', { now: new Date() })
      .getOne();
  }

  async findByEmailVerificationToken(token: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.emailVerificationToken')
      .where('user.emailVerificationToken = :token', { token })
      .getOne();
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email },
      withDeleted: true,
    });
  }

  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
      },
      withDeleted: true,
    });
  }

  async setEmailVerificationToken(id: number, token: string): Promise<void> {
    await this.usersRepository.update(id, {
      emailVerificationToken: token,
    });
  }

  async clearEmailVerificationToken(id: number): Promise<void> {
    await this.usersRepository.update(id, {
      emailVerificationToken: null,
    });
  }

  async markEmailVerified(id: number): Promise<void> {
    await this.usersRepository.update(id, { emailVerified: true });
    await this.cacheManager.del(CACHE_USERS_LIST);
  }

  async setPasswordResetToken(
    id: number,
    token: string,
    expires: Date,
  ): Promise<void> {
    await this.usersRepository.update(id, {
      passwordResetToken: token,
      passwordResetExpires: expires,
    });
  }

  async clearPasswordResetToken(id: number): Promise<void> {
    await this.usersRepository.update(id, {
      passwordResetToken: null,
      passwordResetExpires: null,
    });
  }

  async setRefreshToken(
    id: number,
    currentHash: string,
    previousHash: string | null,
    rotatedAt: Date | null,
  ): Promise<void> {
    await this.usersRepository.update(id, {
      refreshTokenHash: currentHash,
      previousRefreshTokenHash: previousHash,
      refreshTokenRotatedAt: rotatedAt,
    });
  }

  async clearRefreshToken(id: number): Promise<void> {
    await this.usersRepository.update(id, {
      refreshTokenHash: null,
      previousRefreshTokenHash: null,
      refreshTokenRotatedAt: null,
    });
  }

  async update(id: number, updateUserDto: UpdateUserDto): Promise<SafeUser> {
    const user = await this.findById(id);

    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.usersRepository.findOne({
        where: { email: updateUserDto.email },
        withDeleted: true,
      });
      if (existingUser) {
        throw new ConflictException('El email ya está registrado');
      }
    }

    Object.assign(user, updateUserDto);
    const saved = await this.usersRepository.save(user);
    await Promise.all([
      this.cacheManager.del(CACHE_USERS_LIST),
      this.cacheManager.del(`${CACHE_USERS_LIST}/${id}`),
    ]);
    return this.toSafeUser(saved);
  }

  async updateProfile(
    id: number,
    updateProfileDto: UpdateProfileDto,
  ): Promise<SafeUser> {
    const user = await this.findByIdWithPassword(id);
    if (!user) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    if (updateProfileDto.password) {
      if (!updateProfileDto.currentPassword) {
        throw new BadRequestException(
          'Debes ingresar tu contraseña actual para cambiarla',
        );
      }

      const isCurrentPasswordValid = await bcrypt.compare(
        updateProfileDto.currentPassword,
        user.password,
      );
      if (!isCurrentPasswordValid) {
        throw new BadRequestException('La contraseña actual no es correcta');
      }

      user.password = updateProfileDto.password;
    }

    if (updateProfileDto.name !== undefined) {
      user.name = updateProfileDto.name;
    }
    if (updateProfileDto.phone !== undefined) {
      user.phone = updateProfileDto.phone;
    }

    const saved = await this.usersRepository.save(user);

    if (updateProfileDto.password) {
      await this.clearRefreshToken(id);
    }

    await Promise.all([
      this.cacheManager.del(CACHE_USERS_LIST),
      this.cacheManager.del(`${CACHE_USERS_LIST}/${id}`),
    ]);

    return this.toSafeUser(saved);
  }

  async softDelete(id: number): Promise<void> {
    const user = await this.findById(id);
    await this.usersRepository.softRemove(user);
    await Promise.all([
      this.cacheManager.del(CACHE_USERS_LIST),
      this.cacheManager.del(`${CACHE_USERS_LIST}/${id}`),
    ]);
  }

  async restore(id: number): Promise<SafeUser> {
    const user = await this.usersRepository.findOne({
      where: { id },
      withDeleted: true,
    });
    if (!user) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }
    await this.usersRepository.restore(id);
    const restored = await this.findById(id);
    await Promise.all([
      this.cacheManager.del(CACHE_USERS_LIST),
      this.cacheManager.del(`${CACHE_USERS_LIST}/${id}`),
    ]);
    return this.toSafeUser(restored);
  }

  private toSafeUser(user: User): SafeUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
