export interface ExpenseRow {
  id: string;
  name: string;
  description: string;
}

export interface ShiftForm {
  dashCash: string;
  dashCashless: string;
  factCash: string;
  factCashless: string;
  expenses: ExpenseRow[];
}

export interface GoodItemTaken {
  name: string;
  quantity: number;
  price: number;
}

export interface FineInfo {
  amount: number;
  reason: string;
}

export interface SavedReport {
  id: string;
  date: string;
  workerName?: string;
  dashTotal: number;
  dashCash: number;
  dashCashless: number;
  factTotal: number;
  factCash: number;
  factCashless: number;
  expenses: { name: string; description: string }[];
  twoPercent: number;
  difference: number;
  photoBase64?: string;
  goodsTaken?: GoodItemTaken[];
  cashTaken?: number;
  fine?: FineInfo;
}

export interface GoodItem {
  id: string;
  name: string;
  shellQuantity: number;
  factQuantity: string;
}

export interface GoodDifference {
  name: string;
  difference: number;
}

export interface CalculationResult {
  dashTotal: number;
  factTotal: number;
  twoPercent: number;
  expensesTotal: number;
  difference: number;
}

export interface FineRecord {
  id: string;
  workerName: string;
  amount: number;
  reason: string;
  date: string;
  paid: boolean;
}