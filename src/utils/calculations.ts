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
  // К факту прибавляем и уборщицу, и деньги, взятые под ЗП
  const factTotal = factCash + factCashless + cleanerAmount + cashTakenTotal;

  const percent = dashTotal > 10000 ? 0.03 : 0.02;
  const twoPercent = Math.ceil(factTotal * percent);

  const expensesTotal = 0;

  // Разница: факт (с учётом взятых под ЗП) минус дэш + уборщица
  const difference = (factCash + cashTakenTotal - dashCash) + Math.min(factCashless - dashCashless, 0) + cleanerAmount;

  return {
    dashTotal,
    factTotal,
    twoPercent,
    expensesTotal,
    difference,
  };
};