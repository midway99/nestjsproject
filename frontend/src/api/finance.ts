export interface Category {
  id: string;
  userId: string;
  name: string;
  type: 'expense' | 'income';
}

export interface Expense {
  id: string;
  userId: string;
  type: 'expense' | 'income';
  amount: number;
  description: string | null;
  spentAt: string;
  categoryId: string;
  category: Category;
}

export interface ExpenseInput {
  type: 'expense' | 'income';
  amount: number;
  description?: string;
  spentAt: string;
  categoryId: string;
}

export interface ExpenseAnalysis {
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
  generatedAt: string;
}

export interface AnalysisReport extends ExpenseAnalysis {
  id: string;
  userId: string;
  createdAt: string;
}

export interface UserReport {
  id: string;
  subject: string;
  message: string;
  aiTriage: string | null;
  status: string;
  createdAt: string;
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: options?.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  const body = (await response.json()) as T | { message?: string | string[] };
  if (!response.ok) {
    const message = (body as { message?: string | string[] }).message;
    throw new Error(
      Array.isArray(message) ? message.join('. ') : message || 'Ошибка запроса',
    );
  }
  return body as T;
}

export const financeApi = {
  analyze: () => api<ExpenseAnalysis>('/finance/analysis', { method: 'POST' }),
  analysisHistory: () => api<AnalysisReport[]>('/finance/analysis/history'),
  categories: () => api<Category[]>('/finance/categories'),
  createCategory: (name: string, type: 'expense' | 'income') =>
    api<Category>('/finance/categories', {
      method: 'POST',
      body: JSON.stringify({ name, type }),
    }),
  updateCategory: (id: string, name: string) =>
    api<Category>(`/finance/categories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),
  deleteCategory: (id: string) =>
    api<{ deleted: true }>(`/finance/categories/${id}`, {
      method: 'DELETE',
    }),
  expenses: () => api<Expense[]>('/finance/expenses'),
  createExpense: (data: ExpenseInput) =>
    api<Expense>('/finance/expenses', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateExpense: (id: string, data: ExpenseInput) =>
    api<Expense>(`/finance/expenses/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteExpense: (id: string) =>
    api<{ deleted: true }>(`/finance/expenses/${id}`, {
      method: 'DELETE',
    }),
  createReport: (subject: string, message: string) =>
    api<UserReport>('/finance/reports', {
      method: 'POST',
      body: JSON.stringify({ subject, message }),
    }),
};
