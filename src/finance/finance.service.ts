import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../auth/user.entity.js';
import { CategoryEntity } from './category.entity.js';
import { DefaultCategory } from './default-category.enum.js';
import type { CreateCategoryDto } from './dto/create-category.dto.js';
import type { CreateExpenseDto } from './dto/create-expense.dto.js';
import type { UpdateCategoryDto } from './dto/update-category.dto.js';
import type { UpdateExpenseDto } from './dto/update-expense.dto.js';
import { ExpenseEntity } from './expense.entity.js';

@Injectable()
export class FinanceService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    @InjectRepository(CategoryEntity)
    private readonly categoriesRepository: Repository<CategoryEntity>,
    @InjectRepository(ExpenseEntity)
    private readonly expensesRepository: Repository<ExpenseEntity>,
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
      name,
    });
    if (duplicate) {
      throw new ConflictException('Такая категория уже существует');
    }
    return this.categoriesRepository.save(
      this.categoriesRepository.create({ userId, name }),
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
      throw new ConflictException('Сначала удалите расходы из этой категории');
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

  async createExpense(userId: string, dto: CreateExpenseDto) {
    await this.ensureUser(userId);
    await this.getCategory(userId, dto.categoryId);
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
    if (dto.type !== undefined) expense.type = dto.type;
    if (dto.categoryId !== undefined) {
      await this.getCategory(userId, dto.categoryId);
      expense.categoryId = dto.categoryId;
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
      select: { name: true },
    });
    const existingNames = new Set(
      existingCategories.map((category) => category.name),
    );

    const missingCategories = Object.values(DefaultCategory)
      .filter((name) => !existingNames.has(name))
      .map((name) => this.categoriesRepository.create({ userId, name }));

    if (missingCategories.length > 0) {
      await this.categoriesRepository.save(missingCategories);
    }
  }

  private async getCategory(userId: string, id: string) {
    const category = await this.categoriesRepository.findOneBy({ id, userId });
    if (!category) throw new NotFoundException('Категория не найдена');
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
