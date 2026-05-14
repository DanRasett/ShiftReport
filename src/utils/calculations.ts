import { CalculationResult, ShiftForm } from '../types';

export const calculateShift = (form: ShiftForm): CalculationResult => {
  const dashCash = parseFloat(form.dashCash) || 0;
  const dashCashless = parseFloat(form.dashCashless) || 0;
  const factCash = parseFloat(form.factCash) || 0;
  const factCashless = parseFloat(form.factCashless) || 0;

  const dashTotal = dashCash + dashCashless;
  const factTotal = factCash + factCashless;

  // Процент: 3% если Дэш > 10000, иначе 2%
  const percent = dashTotal >= 10000 ? 0.03 : 0.02;
  const twoPercent = Math.ceil(factTotal * percent);

  // Расходы не участвуют в денежном расчёте
  const expensesTotal = 0;

  // Пересдача/недосдача:
  // Нал: факт - дэш
  // Карта: только недосдача (min(факт - дэш, 0))
  const difference = (factCash - dashCash) + Math.min(factCashless - dashCashless, 0);

  return {
    dashTotal,
    factTotal,
    twoPercent,
    expensesTotal,
    difference,
  };
};