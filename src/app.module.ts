import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module.js';
import { FinanceModule } from './finance/finance.module.js';

try {
  process.loadEnvFile();
} catch (error) {
  if (
    !error ||
    typeof error !== 'object' ||
    !('code' in error) ||
    error.code !== 'ENOENT'
  ) {
    throw error;
  }
}

function getDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const user = encodeURIComponent(process.env.POSTGRES_USER ?? 'nest_user');
  const password = encodeURIComponent(
    process.env.POSTGRES_PASSWORD ?? 'nest_password',
  );
  const database = encodeURIComponent(process.env.POSTGRES_DB ?? 'nest_app');
  const port = process.env.POSTGRES_PORT ?? '5432';
  return `postgresql://${user}:${password}@localhost:${port}/${database}`;
}

@Module({
  imports: [
    TypeOrmModule.forRoot(
      process.env.NODE_ENV === 'test'
        ? {
            type: 'sqljs',
            autoSave: false,
            autoLoadEntities: true,
            synchronize: true,
            retryAttempts: 0,
          }
        : {
            type: 'postgres',
            url: getDatabaseUrl(),
            autoLoadEntities: true,
            synchronize: process.env.DB_SYNCHRONIZE === 'true',
            retryAttempts: 10,
            retryDelay: 3000,
          },
    ),
    AuthModule,
    FinanceModule,
  ],
})
export class AppModule {}
