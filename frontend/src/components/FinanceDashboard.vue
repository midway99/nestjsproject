<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import type { User } from '../api/auth';
import {
  financeApi,
  type AnalysisReport,
  type Category,
  type Expense,
  type ExpenseInput,
} from '../api/finance';

const props = defineProps<{ user: User }>();
const emit = defineEmits<{ back: []; logout: [] }>();

const categories = ref<Category[]>([]);
const expenses = ref<Expense[]>([]);
const categoryName = ref('');
const editingId = ref<string | null>(null);
const loading = ref(false);
const analyzing = ref(false);
const reporting = ref(false);
const error = ref('');
const aiAnalysis = ref('');
const analysisHistory = ref<AnalysisReport[]>([]);
const showAnalysisModal = ref(false);
const reportSuccess = ref('');
const form = reactive({
  type: 'expense' as 'expense' | 'income',
  amount: '',
  description: '',
  spentAt: new Date().toISOString().slice(0, 10),
  categoryId: '',
});
const reportForm = reactive({
  subject: '',
  message: '',
});

const totalExpenses = computed(() =>
  expenses.value
    .filter((item) => item.type === 'expense')
    .reduce((sum, item) => sum + Number(item.amount), 0),
);
const totalIncome = computed(() =>
  expenses.value
    .filter((item) => item.type === 'income')
    .reduce((sum, item) => sum + Number(item.amount), 0),
);
const balance = computed(() => totalIncome.value - totalExpenses.value);
const availableCategories = computed(() =>
  categories.value.filter((category) => category.type === form.type),
);

const expensesByCategory = computed(() => {
  const totals = new Map<string, number>();

  for (const expense of expenses.value) {
    if (expense.type !== 'expense') continue;
    const categoryName = expense.category.name;
    totals.set(
      categoryName,
      (totals.get(categoryName) ?? 0) + Number(expense.amount),
    );
  }

  const rows = Array.from(totals, ([name, amount]) => ({ name, amount })).sort(
    (first, second) => second.amount - first.amount,
  );
  const largestAmount = rows[0]?.amount ?? 0;

  return rows.map((row) => ({
    ...row,
    percentage: largestAmount > 0 ? (row.amount / largestAmount) * 100 : 0,
  }));
});

const money = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
});

async function load() {
  loading.value = true;
  error.value = '';
  try {
    [categories.value, expenses.value, analysisHistory.value] = await Promise.all([
      financeApi.categories(),
      financeApi.expenses(),
      financeApi.analysisHistory(),
    ]);
    if (!form.categoryId && availableCategories.value[0]) {
      form.categoryId = availableCategories.value[0].id;
    }
  } catch (requestError) {
    showError(requestError);
  } finally {
    loading.value = false;
  }
}

async function addCategory() {
  if (!categoryName.value.trim()) return;
  try {
    const category = await financeApi.createCategory(
      categoryName.value,
      form.type,
    );
    categories.value.push(category);
    categories.value.sort(
      (a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name),
    );
    form.categoryId ||= category.id;
    categoryName.value = '';
  } catch (requestError) {
    showError(requestError);
  }
}

async function analyzeExpenses() {
  analyzing.value = true;
  error.value = '';
  try {
    const result = await financeApi.analyze();
    aiAnalysis.value = result.analysis;
    showAnalysisModal.value = true;
    analysisHistory.value = await financeApi.analysisHistory();
  } catch (requestError) {
    showError(requestError);
  } finally {
    analyzing.value = false;
  }
}

async function submitReport() {
  if (!reportForm.subject.trim() || !reportForm.message.trim()) return;
  reporting.value = true;
  error.value = '';
  reportSuccess.value = '';
  try {
    await financeApi.createReport(reportForm.subject, reportForm.message);
    reportForm.subject = '';
    reportForm.message = '';
    reportSuccess.value = 'Репорт отправлен и сохранен для разбора.';
  } catch (requestError) {
    showError(requestError);
  } finally {
    reporting.value = false;
  }
}

async function renameCategory(category: Category) {
  const name = window.prompt('Новое название категории', category.name)?.trim();
  if (!name || name === category.name) return;
  try {
    Object.assign(category, await financeApi.updateCategory(category.id, name));
  } catch (requestError) {
    showError(requestError);
  }
}

async function removeCategory(category: Category) {
  if (!window.confirm(`Удалить категорию «${category.name}»?`)) return;
  try {
    await financeApi.deleteCategory(category.id);
    categories.value = categories.value.filter(
      (item) => item.id !== category.id,
    );
    if (form.categoryId === category.id) {
      form.categoryId = availableCategories.value[0]?.id ?? '';
    }
  } catch (requestError) {
    showError(requestError);
  }
}

async function saveExpense() {
  const data: ExpenseInput = {
    type: form.type,
    amount: Number(form.amount),
    description: form.description,
    spentAt: form.spentAt,
    categoryId: form.categoryId,
  };
  error.value = '';
  try {
    if (editingId.value) {
      const updated = await financeApi.updateExpense(editingId.value, data);
      const index = expenses.value.findIndex((item) => item.id === updated.id);
      expenses.value[index] = updated;
    } else {
      expenses.value.unshift(await financeApi.createExpense(data));
    }
    resetForm();
  } catch (requestError) {
    showError(requestError);
  }
}

function editExpense(expense: Expense) {
  editingId.value = expense.id;
  form.type = expense.type;
  form.amount = String(expense.amount);
  form.description = expense.description ?? '';
  form.spentAt = expense.spentAt;
  form.categoryId = expense.categoryId;
}

async function removeExpense(expense: Expense) {
  if (!window.confirm('Удалить этот расход?')) return;
  try {
    await financeApi.deleteExpense(expense.id);
    expenses.value = expenses.value.filter((item) => item.id !== expense.id);
  } catch (requestError) {
    showError(requestError);
  }
}

function resetForm() {
  editingId.value = null;
  form.type = 'expense';
  form.amount = '';
  form.description = '';
  form.spentAt = new Date().toISOString().slice(0, 10);
  form.categoryId = availableCategories.value[0]?.id ?? '';
}

function showError(value: unknown) {
  error.value = value instanceof Error ? value.message : 'Неизвестная ошибка';
}

watch(
  () => form.type,
  () => {
    if (!availableCategories.value.some((category) => category.id === form.categoryId)) {
      form.categoryId = availableCategories.value[0]?.id ?? '';
    }
  },
);

onMounted(load);
</script>

<template>
  <div class="finance-dashboard">
    <header class="dashboard-header">
      <div>
        <p class="eyebrow">Домашняя бухгалтерия</p>
        <h2>Финансы {{ user.name }}</h2>
      </div>
      <div class="dashboard-actions">
        <button class="text-button" type="button" @click="emit('back')">
          ← В профиль
        </button>
        <button class="text-button" type="button" @click="emit('logout')">
          Выйти
        </button>
      </div>
    </header>

    <div class="summary-grid">
      <div class="summary-card income-summary">
        <span>Доходы</span>
        <strong>+ {{ money.format(totalIncome) }}</strong>
      </div>
      <div class="summary-card expense-summary">
        <span>Расходы</span>
        <strong>− {{ money.format(totalExpenses) }}</strong>
      </div>
      <div
        class="summary-card balance-summary"
        :class="{ negative: balance < 0 }"
      >
        <span>Баланс</span>
        <strong>{{ money.format(balance) }}</strong>
        <small>{{ expenses.length }} операций</small>
      </div>
    </div>

    <section class="finance-section category-chart">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Структура расходов</p>
          <h3>Расходы по категориям</h3>
        </div>
        <span v-if="expensesByCategory.length" class="chart-total">
          {{ expensesByCategory.length }} категорий
        </span>
      </div>

      <div
        v-if="expensesByCategory.length"
        class="chart"
        role="img"
        aria-label="Диаграмма расходов по категориям"
      >
        <div
          v-for="row in expensesByCategory"
          :key="row.name"
          class="chart-row"
        >
          <div class="chart-label">
            <span>{{ row.name }}</span>
            <strong>{{ money.format(row.amount) }}</strong>
          </div>
          <div class="chart-track">
            <div
              class="chart-bar"
              :style="{ width: `${row.percentage}%` }"
              :title="`${row.name}: ${money.format(row.amount)}`"
            ></div>
          </div>
        </div>
      </div>
      <div v-else class="empty-state">
        Добавьте расходы, чтобы увидеть диаграмму
      </div>
    </section>

    <section class="ai-analysis">
      <div>
        <p class="eyebrow">Персональный анализ</p>
        <h3>Что ИИ видит в ваших финансах?</h3>
        <p class="muted">
          Доходы и расходы анализируются отдельно, категории не смешиваются.
        </p>
      </div>
      <button
        class="primary-button"
        type="button"
        :disabled="analyzing || !expenses.length"
        @click="analyzeExpenses"
      >
        {{ analyzing ? 'Анализируем…' : 'Анализировать с ИИ' }}
      </button>
    </section>

    <section class="finance-section report-section">
      <div>
        <p class="eyebrow">Обратная связь</p>
        <h3>Репорт для разработчика</h3>
      </div>
      <form class="report-form" @submit.prevent="submitReport">
        <input
          v-model.trim="reportForm.subject"
          maxlength="120"
          placeholder="Коротко: что не так"
          required
        />
        <textarea
          v-model.trim="reportForm.message"
          maxlength="3000"
          placeholder="Опишите проблему, ожидание и что получилось"
          required
        ></textarea>
        <button class="small-button" type="submit" :disabled="reporting">
          {{ reporting ? 'Отправляем…' : 'Отправить' }}
        </button>
      </form>
      <p v-if="reportSuccess" class="message success" role="status">
        {{ reportSuccess }}
      </p>
    </section>

    <section v-if="analysisHistory.length" class="finance-section history-section">
      <div class="section-heading">
        <div>
          <p class="eyebrow">История ИИ</p>
          <h3>Сохраненные отчеты</h3>
        </div>
        <span class="chart-total">{{ analysisHistory.length }}</span>
      </div>
      <button
        v-for="report in analysisHistory"
        :key="report.id"
        class="history-item"
        type="button"
        @click="
          aiAnalysis = report.analysis;
          showAnalysisModal = true;
        "
      >
        <span>
          {{ new Date(report.createdAt).toLocaleString('ru-RU') }}
          <small v-if="report.periodStart && report.periodEnd">
            {{ report.periodStart }} - {{ report.periodEnd }}
          </small>
        </span>
        <em v-if="report.summary">{{ report.summary }}</em>
        <ul v-if="report.recommendations?.length">
          <li
            v-for="recommendation in report.recommendations.slice(0, 2)"
            :key="recommendation"
          >
            {{ recommendation }}
          </li>
        </ul>
        <strong>{{ money.format(report.balance) }}</strong>
      </button>
    </section>

    <div class="finance-grid">
      <section class="finance-section">
        <h3>{{ editingId ? 'Изменить операцию' : 'Новая операция' }}</h3>
        <form class="expense-form" @submit.prevent="saveExpense">
          <label
            >Тип операции
            <select v-model="form.type" required>
              <option value="expense">Расход</option>
              <option value="income">Доход</option>
            </select>
          </label>
          <label
            >Сумма
            <input
              v-model="form.amount"
              type="number"
              min="0.01"
              step="0.01"
              required
            />
          </label>
          <label
            >Категория
            <select v-model="form.categoryId" required>
              <option disabled value="">Выберите категорию</option>
              <option
                v-for="category in availableCategories"
                :key="category.id"
                :value="category.id"
              >
                {{ category.name }}
              </option>
            </select>
          </label>
          <label
            >Дата
            <input v-model="form.spentAt" type="date" required />
          </label>
          <label
            >Описание
            <input
              v-model.trim="form.description"
              maxlength="200"
              placeholder="Например, продукты"
            />
          </label>
          <button class="primary-button" :disabled="!availableCategories.length">
            {{
              editingId
                ? 'Сохранить'
                : form.type === 'income'
                  ? 'Добавить доход'
                  : 'Добавить расход'
            }}
          </button>
          <button
            v-if="editingId"
            class="text-button"
            type="button"
            @click="resetForm"
          >
            Отмена
          </button>
        </form>
      </section>

      <section class="finance-section">
        <h3>Категории</h3>
        <form class="category-form" @submit.prevent="addCategory">
          <input
            v-model.trim="categoryName"
            maxlength="50"
            :placeholder="
              form.type === 'income'
                ? 'Новая категория дохода'
                : 'Новая категория расхода'
            "
            required
          />
          <button class="small-button">Добавить</button>
        </form>
        <div class="category-list">
          <div
            v-for="category in categories"
            :key="category.id"
            class="category-item"
          >
            <span>{{ category.name }}</span>
            <small>{{ category.type === 'income' ? 'Доход' : 'Расход' }}</small>
            <div>
              <button title="Переименовать" @click="renameCategory(category)">
                ✎
              </button>
              <button title="Удалить" @click="removeCategory(category)">
                ×
              </button>
            </div>
          </div>
          <p v-if="!categories.length" class="muted">
            Добавьте первую категорию.
          </p>
        </div>
      </section>
    </div>

    <p v-if="error" class="message error" role="alert">{{ error }}</p>

    <section class="finance-section expense-list">
      <h3>История операций</h3>
      <div v-if="loading" class="muted">Загрузка…</div>
      <div v-else-if="!expenses.length" class="empty-state">
        Операций пока нет
      </div>
      <article
        v-for="expense in expenses"
        :key="expense.id"
        class="expense-item"
        :class="expense.type"
      >
        <div>
          <strong>{{ expense.description || expense.category.name }}</strong>
          <span
            >{{ expense.type === 'income' ? 'Доход' : 'Расход' }} ·
            {{ expense.category.name }} · {{ expense.spentAt }}</span
          >
        </div>
        <b
          >{{ expense.type === 'income' ? '+' : '−' }}
          {{ money.format(Number(expense.amount)) }}</b
        >
        <button @click="editExpense(expense)">✎</button>
        <button @click="removeExpense(expense)">×</button>
      </article>
    </section>

    <div
      v-if="showAnalysisModal"
      class="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="analysis-title"
      @click.self="showAnalysisModal = false"
    >
      <section class="modal-panel">
        <header class="modal-header">
          <h3 id="analysis-title">AI-анализ</h3>
          <button
            class="icon-button"
            type="button"
            aria-label="Закрыть"
            @click="showAnalysisModal = false"
          >
            ×
          </button>
        </header>
        <div class="analysis-result">{{ aiAnalysis }}</div>
      </section>
    </div>
  </div>
</template>
