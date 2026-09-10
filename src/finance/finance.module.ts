import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../auth/user.entity.js';
import { AnalysisReportEntity } from './analysis-report.entity.js';
import { AuthModule } from '../auth/auth.module.js';
import { CategoryEntity } from './category.entity.js';
import { ExpenseEntity } from './expense.entity.js';
import { FinanceController } from './finance.controller.js';
import { FinanceService } from './finance.service.js';
import { ExpenseAnalysisService } from './expense-analysis.service.js';
import { UserReportEntity } from './user-report.entity.js';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      UserEntity,
      CategoryEntity,
      ExpenseEntity,
      AnalysisReportEntity,
      UserReportEntity,
    ]),
  ],
  controllers: [FinanceController],
  providers: [FinanceService, ExpenseAnalysisService],
})
export class FinanceModule {}
