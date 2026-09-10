import { TransactionType } from './transaction-type.enum.js';

export const defaultCategories: Record<TransactionType, string[]> = {
  [TransactionType.INCOME]: [
    'Зарплата',
    'Фриланс',
    'Пособия и выплаты',
    'Подарки',
    'Другие доходы',
  ],
  [TransactionType.EXPENSE]: [
    'Еда',
    'Транспорт и такси',
    'Жильё',
    'Коммунальные услуги',
    'Здоровье',
    'Покупки',
    'Развлечения',
    'Образование',
    'Подписки',
    'Путешествия',
    'Прочее',
  ],
};
