import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUserId } from '../auth/current-user-id.decorator.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { CreateExpenseDto } from './dto/create-expense.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';
import { UpdateExpenseDto } from './dto/update-expense.dto.js';
import { FinanceService } from './finance.service.js';
import { ExpenseAnalysisService } from './expense-analysis.service.js';

@UseGuards(SessionAuthGuard)
@Controller('finance')
export class FinanceController {
  constructor(
    private readonly financeService: FinanceService,
    private readonly expenseAnalysisService: ExpenseAnalysisService,
  ) {}

  @Post('analysis')
  async analyzeExpenses(@CurrentUserId() userId: string) {
    const expenses = await this.financeService.getExpensesForAnalysis(userId);
    return this.expenseAnalysisService.analyze(expenses);
  }

  @Get('categories')
  getCategories(@CurrentUserId() userId: string) {
    return this.financeService.getCategories(userId);
  }

  @Post('categories')
  createCategory(
    @CurrentUserId() userId: string,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.financeService.createCategory(userId, dto);
  }

  @Patch('categories/:categoryId')
  updateCategory(
    @CurrentUserId() userId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.financeService.updateCategory(userId, categoryId, dto);
  }

  @Delete('categories/:categoryId')
  deleteCategory(
    @CurrentUserId() userId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
  ) {
    return this.financeService.deleteCategory(userId, categoryId);
  }

  @Get('expenses')
  getExpenses(@CurrentUserId() userId: string) {
    return this.financeService.getExpenses(userId);
  }

  @Post('expenses')
  createExpense(
    @CurrentUserId() userId: string,
    @Body() dto: CreateExpenseDto,
  ) {
    return this.financeService.createExpense(userId, dto);
  }

  @Patch('expenses/:expenseId')
  updateExpense(
    @CurrentUserId() userId: string,
    @Param('expenseId', ParseUUIDPipe) expenseId: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.financeService.updateExpense(userId, expenseId, dto);
  }

  @Delete('expenses/:expenseId')
  deleteExpense(
    @CurrentUserId() userId: string,
    @Param('expenseId', ParseUUIDPipe) expenseId: string,
  ) {
    return this.financeService.deleteExpense(userId, expenseId);
  }
}
