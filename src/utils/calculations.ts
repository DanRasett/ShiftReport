import { CalculationResult, ShiftForm } from '../types';

export const calculateShift = (form: ShiftForm, cleanerAmount: number = 0): CalculationResult => {
  const dashCash = parseFloat(form.dashCash) || 0;
  const dashCashless = parseFloat(form.dashCashless) || 0;
  const factCash = parseFloat(form.factCash) || 0;
  const factCashless = parseFloat(form.factCashless) || 0;

  const dashTotal = dashCash + dashCashless;
  const factTotal = factCash + factCashless + cleanerAmount;

  const percent = dashTotal > 10000 ? 0.03 : 0.02;
  const twoPercent = Math.ceil(factTotal * percent);

  const expensesTotal = 0;

  const difference = (factCash - dashCash) + Math.min(factCashless - dashCashless, 0) + cleanerAmount;

  return {
    dashTotal,
    factTotal,
    twoPercent,
    expensesTotal,
    difference,
  };
};