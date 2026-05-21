import { CalculationResult, ShiftForm } from '../types';

export const calculateShift = (
  form: ShiftForm,
  cleanerAmount: number = 0,
  cashTakenTotal: number = 0
): CalculationResult => {
  const dashCash = parseFloat(form.dashCash) || 0;
  const dashCashless = parseFloat(form.dashCashless) || 0;
  const factCash = parseFloat(form.factCash) || 0;
  const factCashless = parseFloat(form.factCashless) || 0;

  const dashTotal = dashCash + dashCashless;
  const factTotal = factCash + factCashless + cleanerAmount + cashTakenTotal;

  const percent = dashTotal > 10000 ? 0.03 : 0.02;
  const twoPercent = Math.ceil(factTotal * percent);

  // Недосдача/пересдача
  const cashDiff = factCash + cashTakenTotal - dashCash;
  const cashlessOver = Math.max(0, factCashless - dashCashless); // пересдача по карте
  let difference = cashDiff + Math.min(factCashless - dashCashless, 0) + cleanerAmount;

  // Пересдача по карте компенсирует недосдачу по налу
  if (difference < 0 && cashlessOver > 0) {
    difference = Math.min(0, difference + cashlessOver);
  }

  return {
    dashTotal,
    factTotal,
    twoPercent,
    expensesTotal: 0,
    difference,
  };
};