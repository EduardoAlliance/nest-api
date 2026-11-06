import {
  Injectable,
  NotFoundException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Repository } from 'typeorm';
import type { Cache } from 'cache-manager';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUserDto } from './dto/query-user.dto';

const CACHE_USERS_LIST = '/api/v1/users';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
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
    return saved;
  }

  async findAll(queryDto: QueryUserDto): Promise<{ data: User[]; total: number; page: number; limit: number }> {
    const page = queryDto.page || 1;
    const limit = queryDto.limit || 10;
    const skip = (page - 1) * limit;

    const queryBuilder = this.usersRepository.createQueryBuilder('user');

    if (queryDto.search) {
      queryBuilder.where(
        '(user.name LIKE :search OR user.email LIKE :search)',
        { search: `%${queryDto.search}%` },
      );
    }

    if (queryDto.role) {
      queryBuilder.andWhere('user.role = :role', { role: queryDto.role });
    }

    if (queryDto.isActive !== undefined) {
      queryBuilder.andWhere('user.isActive = :isActive', { isActive: queryDto.isActive });
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
      } as any,
      withDeleted: true,
    });
  }

  async update(id: number, updateUserDto: UpdateUserDto): Promise<User> {
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
    return saved;
  }

  async softDelete(id: number): Promise<void> {
    const user = await this.findById(id);
    await this.usersRepository.softRemove(user);
    await Promise.all([
      this.cacheManager.del(CACHE_USERS_LIST),
      this.cacheManager.del(`${CACHE_USERS_LIST}/${id}`),
    ]);
  }

  async restore(id: number): Promise<User> {
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
    return restored;
  }
}
