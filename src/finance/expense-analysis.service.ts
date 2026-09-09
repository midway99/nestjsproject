import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import OpenAI from 'openai';
import type { ExpenseEntity } from './expense.entity.js';

@Injectable()
export class ExpenseAnalysisService {
  private readonly logger = new Logger(ExpenseAnalysisService.name);

  async analyze(expenses: ExpenseEntity[]) {
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
        max_tokens: 1200,
        messages: [
          {
            role: 'system',
            content:
              'Ты помощник по домашнему бюджету. Проанализируй JSON расходов на русском языке. ' +
              'Укажи основные категории, заметные закономерности, возможные точки экономии и 3–5 конкретных рекомендаций. ' +
              'Не выдумывай доходы или данные, которых нет. Не давай инвестиционных рекомендаций. ' +
              'Кратко предупреди, что результат носит информационный характер.',
          },
          { role: 'user', content: JSON.stringify(payload) },
        ],
      });

      const analysis = response.choices[0]?.message.content;
      if (!analysis) {
        throw new Error('OpenRouter returned an empty response');
      }

      return {
        analysis,
        expenseCount: expenses.length,
        total: payload.total,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof OpenAI.APIError && [402, 429].includes(error.status)) {
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

  private createPayload(expenses: ExpenseEntity[]) {
    const rows = expenses.slice(0, 500).map((expense) => ({
      amount: Number(expense.amount),
      date: expense.spentAt,
      category: expense.category.name,
      description: expense.description,
    }));

    const byCategory = rows.reduce<Record<string, number>>((result, expense) => {
      result[expense.category] =
        (result[expense.category] ?? 0) + expense.amount;
      return result;
    }, {});

    return {
      currency: 'RUB',
      total: rows.reduce((sum, expense) => sum + expense.amount, 0),
      byCategory,
      expenses: rows,
      note:
        expenses.length > rows.length
          ? `Переданы последние ${rows.length} из ${expenses.length} расходов`
          : undefined,
    };
  }
}
