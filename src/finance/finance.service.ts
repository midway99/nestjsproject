import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../auth/user.entity.js';
import { AnalysisReportEntity } from './analysis-report.entity.js';
import { CategoryEntity } from './category.entity.js';
import { defaultCategories } from './default-category.enum.js';
import type { CreateUserReportDto } from './dto/create-user-report.dto.js';
import type { CreateCategoryDto } from './dto/create-category.dto.js';
import type { CreateExpenseDto } from './dto/create-expense.dto.js';
import type { UpdateCategoryDto } from './dto/update-category.dto.js';
import type { UpdateExpenseDto } from './dto/update-expense.dto.js';
import { ExpenseEntity } from './expense.entity.js';
import { TransactionType } from './transaction-type.enum.js';
import { UserReportEntity } from './user-report.entity.js';

@Injectable()
export class FinanceService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    @InjectRepository(CategoryEntity)
    private readonly categoriesRepository: Repository<CategoryEntity>,
    @InjectRepository(ExpenseEntity)
    private readonly expensesRepository: Repository<ExpenseEntity>,
    @InjectRepository(AnalysisReportEntity)
    private readonly analysisReportsRepository: Repository<AnalysisReportEntity>,
    @InjectRepository(UserReportEntity)
    private readonly userReportsRepository: Repository<UserReportEntity>,
  ) {}

  async getCategories(userId: string) {
    await this.ensureUser(userId);
    await this.createDefaultCategoriesIfNeeded(userId);
    return this.categoriesRepository.find({
      where: { userId },
      order: { name: 'ASC' },
    });
  }

  async createCategory(userId: string, dto: CreateCategoryDto) {
    await this.ensureUser(userId);
    const name = dto.name.trim();
    const duplicate = await this.categoriesRepository.findOneBy({
      userId,
      type: dto.type,
      name,
    });
    if (duplicate) {
      throw new ConflictException('Такая категория уже существует');
    }
    return this.categoriesRepository.save(
      this.categoriesRepository.create({ userId, name, type: dto.type }),
    );
  }

  async updateCategory(
    userId: string,
    categoryId: string,
    dto: UpdateCategoryDto,
  ) {
    const category = await this.getCategory(userId, categoryId);
    category.name = dto.name.trim();
    return this.categoriesRepository.save(category);
  }

  async deleteCategory(userId: string, categoryId: string) {
    const category = await this.getCategory(userId, categoryId);
    const expensesCount = await this.expensesRepository.countBy({
      userId,
      categoryId,
    });
    if (expensesCount > 0) {
      throw new ConflictException('Сначала удалите операции из этой категории');
    }
    await this.categoriesRepository.remove(category);
    return { deleted: true };
  }

  async getExpenses(userId: string) {
    await this.ensureUser(userId);
    return this.expensesRepository.find({
      where: { userId },
      relations: { category: true },
      order: { spentAt: 'DESC', createdAt: 'DESC' },
    });
  }

  async getExpensesForAnalysis(userId: string) {
    return this.getExpenses(userId);
  }

  async getAnalysisHistory(userId: string) {
    await this.ensureUser(userId);
    return this.analysisReportsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 20,
    });
  }

  async saveAnalysisReport(
    userId: string,
    report: {
      analysis: string;
      expenseCount: number;
      totalExpenses: number;
      totalIncome: number;
      balance: number;
      summary: string;
      recommendations: string[];
      snapshot: Record<string, unknown>;
      model: string;
      periodStart: string | null;
      periodEnd: string | null;
    },
  ) {
    await this.ensureUser(userId);
    return this.analysisReportsRepository.save(
      this.analysisReportsRepository.create({ userId, ...report }),
    );
  }

  async createUserReport(
    userId: string,
    dto: CreateUserReportDto,
    aiTriage: string | null,
  ) {
    await this.ensureUser(userId);
    return this.userReportsRepository.save(
      this.userReportsRepository.create({
        userId,
        subject: dto.subject.trim(),
        message: dto.message.trim(),
        aiTriage,
        status: 'new',
      }),
    );
  }

  async createExpense(userId: string, dto: CreateExpenseDto) {
    await this.ensureUser(userId);
    await this.getCategoryForType(userId, dto.categoryId, dto.type);
    const expense = this.expensesRepository.create({
      userId,
      type: dto.type,
      amount: dto.amount,
      description: dto.description?.trim() || null,
      spentAt: dto.spentAt.slice(0, 10),
      categoryId: dto.categoryId,
    });
    return this.getExpenseWithCategory(
      userId,
      (await this.expensesRepository.save(expense)).id,
    );
  }

  async updateExpense(
    userId: string,
    expenseId: string,
    dto: UpdateExpenseDto,
  ) {
    const expense = await this.getExpense(userId, expenseId);
    if (dto.categoryId !== undefined) {
      await this.getCategoryForType(
        userId,
        dto.categoryId,
        dto.type ?? expense.type,
      );
      expense.categoryId = dto.categoryId;
    }
    if (dto.type !== undefined) {
      await this.getCategoryForType(userId, expense.categoryId, dto.type);
      expense.type = dto.type;
    }
    if (dto.amount !== undefined) expense.amount = dto.amount;
    if (dto.description !== undefined) {
      expense.description = dto.description.trim() || null;
    }
    if (dto.spentAt !== undefined) expense.spentAt = dto.spentAt.slice(0, 10);
    await this.expensesRepository.save(expense);
    return this.getExpenseWithCategory(userId, expenseId);
  }

  async deleteExpense(userId: string, expenseId: string) {
    await this.expensesRepository.remove(
      await this.getExpense(userId, expenseId),
    );
    return { deleted: true };
  }

  private async ensureUser(userId: string) {
    if (!(await this.usersRepository.existsBy({ id: userId }))) {
      throw new NotFoundException('Пользователь не найден');
    }
  }

  private async createDefaultCategoriesIfNeeded(userId: string) {
    const existingCategories = await this.categoriesRepository.find({
      where: { userId },
      select: { name: true, type: true },
    });
    const existingNames = new Set(
      existingCategories.map((category) => `${category.type}:${category.name}`),
    );

    const missingCategories = Object.entries(defaultCategories).flatMap(
      ([type, names]) =>
        names
          .filter((name) => !existingNames.has(`${type}:${name}`))
          .map((name) =>
            this.categoriesRepository.create({
              userId,
              type: type as TransactionType,
              name,
            }),
          ),
    );

    if (missingCategories.length > 0) {
      await this.categoriesRepository.save(missingCategories);
    }
  }

  private async getCategory(userId: string, id: string) {
    const category = await this.categoriesRepository.findOneBy({ id, userId });
    if (!category) throw new NotFoundException('Категория не найдена');
    return category;
  }

  private async getCategoryForType(
    userId: string,
    id: string,
    type: TransactionType,
  ) {
    const category = await this.getCategory(userId, id);
    if (category.type !== type) {
      throw new ConflictException(
        'Категория не подходит для выбранного типа операции',
      );
    }
    return category;
  }

  private async getExpense(userId: string, id: string) {
    const expense = await this.expensesRepository.findOneBy({ id, userId });
    if (!expense) throw new NotFoundException('Расход не найден');
    return expense;
  }

  private async getExpenseWithCategory(userId: string, id: string) {
    const expense = await this.expensesRepository.findOne({
      where: { id, userId },
      relations: { category: true },
    });
    if (!expense) throw new NotFoundException('Расход не найден');
    return expense;
  }
}
