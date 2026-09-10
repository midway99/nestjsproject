import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import OpenAI from 'openai';
import { AnalysisReportEntity } from './analysis-report.entity.js';
import type { ExpenseEntity } from './expense.entity.js';
import { TransactionType } from './transaction-type.enum.js';
import type { UserReportEntity } from './user-report.entity.js';

@Injectable()
export class ExpenseAnalysisService {
  private readonly logger = new Logger(ExpenseAnalysisService.name);

  async analyze(
    expenses: ExpenseEntity[],
    history: AnalysisReportEntity[] = [],
  ) {
    if (expenses.length === 0) {
      throw new BadRequestException('Добавьте хотя бы один расход для анализа');
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'ИИ-анализ не настроен: отсутствует OPENROUTER_API_KEY',
      );
    }

    const payload = this.createPayload(expenses);
    const historicalContext = this.createHistoricalContext(history, payload);
    const model = process.env.OPENROUTER_MODEL ?? 'openrouter/free';

    try {
      const client = new OpenAI({
        apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer':
            process.env.OPENROUTER_SITE_URL ?? 'http://localhost:3000',
          'X-OpenRouter-Title':
            process.env.OPENROUTER_APP_NAME ?? 'Household Finance',
        },
      });

      const response = await client.chat.completions.create({
        model,
        max_tokens: 700,
        messages: [
          {
            role: 'system',
            content:
              'Ты помощник по домашнему бюджету. Проанализируй JSON финансовых операций на русском языке. ' +
              'Строго различай type=income и type=expense: категории доходов нельзя трактовать как траты или советовать их сократить. ' +
              'Укажи основные доходы, основные расходы, заметные закономерности, возможные точки экономии только по расходам и 3–5 конкретных рекомендаций. ' +
              'Если есть historicalContext, сравни текущий снимок с прошлой историей, оцени выполнение прошлых советов, отметь прогресс без лести и покажи тенденцию поведения пользователя. ' +
              'Подбирай советы под текущую модель трат пользователя, а не давай универсальные рекомендации. ' +
              'Если данных мало, явно скажи, что выводы предварительные. ' +
              'Не выдумывай доходы или данные, которых нет. Не давай инвестиционных рекомендаций. ' +
              'Кратко предупреди, что результат носит информационный характер. ' +
              'В конце добавь секцию "Советы на следующий период:" со списком конкретных советов.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              currentSnapshot: payload,
              historicalContext,
            }),
          },
        ],
      });

      const analysis = response.choices[0]?.message.content;
      if (!analysis) {
        throw new Error('OpenRouter returned an empty response');
      }

      return {
        analysis,
        expenseCount: expenses.length,
        totalExpenses: payload.totalExpenses,
        totalIncome: payload.totalIncome,
        balance: payload.balance,
        summary: this.createSummary(payload, history),
        recommendations: this.extractRecommendations(analysis),
        snapshot: payload,
        model,
        periodStart: payload.periodStart,
        periodEnd: payload.periodEnd,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      if (
        error instanceof OpenAI.APIError &&
        [402, 429].includes(error.status)
      ) {
        throw new ServiceUnavailableException(
          'У OpenRouter недостаточно кредитов или превышен лимит запросов',
        );
      }

      this.logger.error(
        'OpenRouter expense analysis failed',
        error instanceof Error ? error.stack : undefined,
      );
      throw new BadGatewayException(
        'Не удалось получить анализ от ИИ. Попробуйте позже',
      );
    }
  }

  async triageUserReport(
    report: Pick<UserReportEntity, 'subject' | 'message'>,
  ) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return null;

    try {
      const client = new OpenAI({
        apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer':
            process.env.OPENROUTER_SITE_URL ?? 'http://localhost:3000',
          'X-OpenRouter-Title':
            process.env.OPENROUTER_APP_NAME ?? 'Household Finance',
        },
      });

      const response = await client.chat.completions.create({
        model: process.env.OPENROUTER_MODEL ?? 'openrouter/free',
        max_tokens: 350,
        messages: [
          {
            role: 'system',
            content:
              'Ты помощник разработчика. Кратко разбери пользовательский репорт: тип проблемы, приоритет, ожидаемое поведение, фактическое поведение и возможные технические причины. Пиши по-русски.',
          },
          { role: 'user', content: JSON.stringify(report) },
        ],
      });

      return response.choices[0]?.message.content ?? null;
    } catch (error) {
      this.logger.warn(
        'OpenRouter report triage failed',
        error instanceof Error ? error.stack : undefined,
      );
      return null;
    }
  }

  private createPayload(expenses: ExpenseEntity[]) {
    const rows = expenses.slice(0, 150).map((expense) => ({
      type: expense.type,
      amount: Number(expense.amount),
      date: expense.spentAt,
      category: expense.category.name,
      description: expense.description,
    }));

    const expenseRows = rows.filter(
      (row) => row.type === TransactionType.EXPENSE,
    );
    const incomeRows = rows.filter(
      (row) => row.type === TransactionType.INCOME,
    );

    const expensesByCategory = expenseRows.reduce<Record<string, number>>(
      (result, expense) => {
        result[expense.category] =
          (result[expense.category] ?? 0) + expense.amount;
        return result;
      },
      {},
    );
    const incomeByCategory = incomeRows.reduce<Record<string, number>>(
      (result, expense) => {
        result[expense.category] =
          (result[expense.category] ?? 0) + expense.amount;
        return result;
      },
      {},
    );

    const totalExpenses = expenseRows.reduce(
      (sum, expense) => sum + expense.amount,
      0,
    );
    const totalIncome = incomeRows.reduce(
      (sum, expense) => sum + expense.amount,
      0,
    );

    return {
      currency: 'RUB',
      periodStart: rows.at(-1)?.date ?? null,
      periodEnd: rows[0]?.date ?? null,
      totalExpenses,
      totalIncome,
      balance: totalIncome - totalExpenses,
      operationCount: rows.length,
      expensesByCategory,
      incomeByCategory,
      operations: rows,
      note:
        expenses.length > rows.length
          ? `Переданы последние ${rows.length} из ${expenses.length} операций`
          : undefined,
    };
  }

  private createHistoricalContext(
    history: AnalysisReportEntity[],
    currentSnapshot: ReturnType<typeof this.createPayload>,
  ) {
    const reports = history.slice(0, 8).map((report) => ({
      createdAt: report.createdAt.toISOString(),
      periodStart: report.periodStart,
      periodEnd: report.periodEnd,
      totalExpenses: report.totalExpenses,
      totalIncome: report.totalIncome,
      balance: report.balance,
      summary: report.summary,
      recommendations: report.recommendations,
      snapshot: report.snapshot,
    }));

    return {
      previousReports: reports,
      trend: this.calculateTrend(reports, currentSnapshot),
    };
  }

  private calculateTrend(
    reports: Array<{
      totalExpenses: number;
      totalIncome: number;
      balance: number;
      snapshot: Record<string, unknown> | null;
    }>,
    currentSnapshot: ReturnType<typeof this.createPayload>,
  ) {
    const previous = reports[0];
    if (!previous) return null;

    return {
      expensesDelta: currentSnapshot.totalExpenses - previous.totalExpenses,
      incomeDelta: currentSnapshot.totalIncome - previous.totalIncome,
      balanceDelta: currentSnapshot.balance - previous.balance,
      previousTopExpenseCategories: this.getTopCategories(previous.snapshot),
      currentTopExpenseCategories: this.getTopCategories(currentSnapshot),
    };
  }

  private getTopCategories(snapshot: Record<string, unknown> | null) {
    const categories = snapshot?.expensesByCategory;
    if (!categories || typeof categories !== 'object') return [];

    return Object.entries(categories as Record<string, number>)
      .sort(([, firstAmount], [, secondAmount]) => secondAmount - firstAmount)
      .slice(0, 5)
      .map(([name, amount]) => ({ name, amount }));
  }

  private createSummary(
    payload: ReturnType<typeof this.createPayload>,
    history: AnalysisReportEntity[],
  ) {
    const previous = history[0];
    if (!previous) {
      return `Первый анализ: доходы ${payload.totalIncome}, расходы ${payload.totalExpenses}, баланс ${payload.balance}.`;
    }

    const expenseDelta = payload.totalExpenses - previous.totalExpenses;
    const balanceDelta = payload.balance - previous.balance;
    return `Сравнение с прошлым отчетом: расходы ${this.formatDelta(expenseDelta)}, баланс ${this.formatDelta(balanceDelta)}.`;
  }

  private formatDelta(value: number) {
    if (value === 0) return 'без изменений';
    return `${value > 0 ? '+' : ''}${value}`;
  }

  private extractRecommendations(analysis: string) {
    const section =
      analysis.split(/Советы на следующий период:/i)[1] ?? analysis;
    return section
      .split('\n')
      .map((line) => line.replace(/^[-*\d.)\s]+/, '').trim())
      .filter((line) => line.length >= 12)
      .slice(0, 7);
  }
}
