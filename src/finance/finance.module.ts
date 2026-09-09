import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../auth/user.entity.js';
import { AuthModule } from '../auth/auth.module.js';
import { CategoryEntity } from './category.entity.js';
import { ExpenseEntity } from './expense.entity.js';
import { FinanceController } from './finance.controller.js';
import { FinanceService } from './finance.service.js';
import { ExpenseAnalysisService } from './expense-analysis.service.js';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([UserEntity, CategoryEntity, ExpenseEntity]),
  ],
  controllers: [FinanceController],
  providers: [FinanceService, ExpenseAnalysisService],
})
export class FinanceModule {}
