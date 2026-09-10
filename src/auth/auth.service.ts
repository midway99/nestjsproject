import {
  ConflictException,
  NotFoundException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { compare, hash } from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { Repository } from 'typeorm';
import type { LoginDto } from './dto/login.dto.js';
import type { RegisterDto } from './dto/register.dto.js';
import type { RequestPasswordResetDto } from './dto/request-password-reset.dto.js';
import type { ResetPasswordDto } from './dto/reset-password.dto.js';
import type { UpdateProfileDto } from './dto/update-profile.dto.js';
import { type PublicUser, UserRole } from './auth.types.js';
import { UserEntity } from './user.entity.js';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
  ) {}

  async register(dto: RegisterDto): Promise<PublicUser> {
    const email = dto.email.trim().toLowerCase();

    const existingUser = await this.usersRepository.findOneBy({ email });
    if (existingUser) {
      throw new ConflictException('Пользователь с таким email уже существует');
    }

    const user = this.usersRepository.create({
      email,
      name: dto.name.trim(),
      passwordHash: await hash(dto.password, 12),
      role: this.getRoleForEmail(email),
    });

    try {
      return this.toPublicUser(await this.usersRepository.save(user));
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          'Пользователь с таким email уже существует',
        );
      }
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<PublicUser> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.usersRepository.findOneBy({ email });

    if (!user || !(await compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    return this.toPublicUser(user);
  }

  async requestPasswordReset(dto: RequestPasswordResetDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.usersRepository.findOneBy({ email });
    if (!user) {
      return {
        message:
          'Если пользователь существует, инструкция для восстановления будет отправлена',
      };
    }

    const token = randomBytes(32).toString('hex');
    user.passwordResetTokenHash = await hash(token, 12);
    user.passwordResetExpiresAt = new Date(Date.now() + 1000 * 60 * 30);
    await this.usersRepository.save(user);

    return {
      message:
        'Токен восстановления создан. В продакшене его нужно отправлять по email',
      resetToken: token,
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const users = await this.usersRepository.find({
      where: {},
      select: {
        id: true,
        passwordHash: true,
        passwordResetTokenHash: true,
        passwordResetExpiresAt: true,
      },
    });
    const now = new Date();

    for (const user of users) {
      if (!user.passwordResetTokenHash || !user.passwordResetExpiresAt) {
        continue;
      }
      if (user.passwordResetExpiresAt <= now) {
        continue;
      }
      if (await compare(dto.token, user.passwordResetTokenHash)) {
        user.passwordHash = await hash(dto.password, 12);
        user.passwordResetTokenHash = null;
        user.passwordResetExpiresAt = null;
        await this.usersRepository.save(user);
        return { passwordReset: true };
      }
    }

    throw new NotFoundException('Токен восстановления недействителен');
  }

  async findPublicUserById(id: string): Promise<PublicUser> {
    const user = await this.usersRepository.findOneBy({ id });
    if (!user) {
      throw new UnauthorizedException('Пользователь не найден');
    }
    return this.toPublicUser(user);
  }

  async updateProfile(id: string, dto: UpdateProfileDto): Promise<PublicUser> {
    const user = await this.usersRepository.findOneBy({ id });
    if (!user) {
      throw new UnauthorizedException('Пользователь не найден');
    }

    user.name = dto.name.trim();
    user.lastName = dto.lastName.trim();
    return this.toPublicUser(await this.usersRepository.save(user));
  }

  private toPublicUser(user: UserEntity): PublicUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      lastName: user.lastName ?? null,
      role: user.role,
    };
  }

  private getRoleForEmail(email: string): UserRole {
    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    return adminEmail && email === adminEmail ? UserRole.ADMIN : UserRole.USER;
  }

  private isUniqueViolation(error: unknown): boolean {
    if (!error || typeof error !== 'object' || !('code' in error)) {
      return false;
    }
    return error.code === '23505';
  }
}
