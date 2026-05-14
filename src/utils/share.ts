import { Share } from 'react-native';
import { ShiftForm, CalculationResult, ExpenseRow } from '../types';

const formatNumber = (n: number): string => n.toLocaleString('ru-RU');

export const shareReport = async (
  form: ShiftForm,
  calc: CalculationResult,
  expenses: ExpenseRow[]
): Promise<string> => {
  const expensesText = expenses
    .filter((e) => e.name.trim() || e.description.trim())
    .map((e) => `${e.name}: ${e.description}`)
    .join('\n');

  const diffText =
    calc.difference > 0
      ? `Пересдача: +${formatNumber(calc.difference)} ₽`
      : calc.difference < 0
      ? `Недосдача: ${formatNumber(calc.difference)} ₽`
      : `0 ₽ (сходится)`;

  const text = `Сдача смены
---
Дэш: ${formatNumber(calc.dashTotal)}
Нал: ${formatNumber(parseFloat(form.dashCash) || 0)}
Карта: ${formatNumber(parseFloat(form.dashCashless) || 0)}
---
Факт: ${formatNumber(calc.factTotal)}
Нал: ${formatNumber(parseFloat(form.factCash) || 0)}
Карта: ${formatNumber(parseFloat(form.factCashless) || 0)}
---
Расходы:
${expensesText || '—'}
---
2%: ${formatNumber(calc.twoPercent)}
---
${diffText}`;

  await Share.share({ message: text });
  return text;
};