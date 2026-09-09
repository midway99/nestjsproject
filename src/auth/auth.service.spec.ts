import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Repository } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service.js';
import { UserEntity } from './user.entity.js';

function createService() {
  const users: UserEntity[] = [];
  const repository = {
    findOneBy: vi.fn(async ({ email }: { email?: string }) =>
      users.find((user) => user.email === email) ?? null,
    ),
    create: vi.fn((data: Partial<UserEntity>) =>
      Object.assign(new UserEntity(), data),
    ),
    save: vi.fn(async (user: UserEntity) => {
      const saved = Object.assign(user, {
        id: user.id ?? randomUUID(),
        createdAt: user.createdAt ?? new Date(),
      });
      users.push(saved);
      return saved;
    }),
  } as unknown as Repository<UserEntity>;

  return new AuthService(repository);
}

describe('AuthService', () => {
  it('registers a user and allows login', async () => {
    const service = createService();
    const credentials = {
      email: 'User@Example.com',
      name: 'Test User',
      password: 'password123',
    };

    const registered = await service.register(credentials);
    const loggedIn = await service.login({
      email: 'user@example.com',
      password: credentials.password,
    });

    expect(registered.email).toBe('user@example.com');
    expect(loggedIn).toEqual(registered);
    expect(registered).not.toHaveProperty('passwordHash');
  });

  it('rejects duplicate email addresses', async () => {
    const service = createService();
    const dto = {
      email: 'user@example.com',
      name: 'Test User',
      password: 'password123',
    };

    await service.register(dto);

    await expect(service.register(dto)).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects an invalid password', async () => {
    const service = createService();
    await service.register({
      email: 'user@example.com',
      name: 'Test User',
      password: 'password123',
    });

    await expect(
      service.login({
        email: 'user@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
