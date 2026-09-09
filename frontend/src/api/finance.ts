export interface Category {
  id: string;
  userId: string;
  name: string;
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
  generatedAt: string;
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
  categories: () => api<Category[]>('/finance/categories'),
  createCategory: (name: string) =>
    api<Category>('/finance/categories', {
      method: 'POST',
      body: JSON.stringify({ name }),
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
};
