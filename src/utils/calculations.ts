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
  const transfers = parseFloat(form.transfers) || 0; // ← добавить

  const dashTotal = dashCash + dashCashless;
  // Переводы прибавляются к наличным в факте
  const factTotal = factCash + factCashless + cleanerAmount + cashTakenTotal + transfers;

  const percent = dashTotal > 10000 ? 0.03 : 0.02;
  const twoPercent = Math.ceil(factTotal * percent);

  const cashDiff = factCash + cashTakenTotal + transfers - dashCash;
  const cashlessOver = Math.max(0, factCashless - dashCashless);
  let difference = cashDiff + Math.min(factCashless - dashCashless, 0) + cleanerAmount;

  if (difference < 0 && cashlessOver > 0) {
    difference = Math.min(0, difference + cashlessOver);
  }

  return { dashTotal, factTotal, twoPercent, expensesTotal: 0, difference };
};