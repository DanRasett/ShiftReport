import AsyncStorage from '@react-native-async-storage/async-storage';
import { SavedReport, FineRecord } from '../types';
import { supabase } from './supabase';

const CREDENTIALS_KEY = '@smartshell_credentials';
const DRAFT_KEY = '@shift_draft';
const GOODS_DRAFT_KEY = '@goods_draft';
const SUPABASE_URL = 'https://glilovtznlhiskipkrkk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsaWxvdnR6bmxoaXNraXBrcmtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzOTE0NjksImV4cCI6MjA5Mzk2NzQ2OX0.5JbTDMdq7wRoNPK54DD7j7KwWaZtJjGlWm1aD_xe_co';


// ============================================================
// Отчёты
// ============================================================
export const saveReport = async (report: SavedReport): Promise<void> => {
  // Сохраняем локально всегда
  const localHistory = await getLocalHistory();
  localHistory.unshift(report);
  await AsyncStorage.setItem('@local_history', JSON.stringify(localHistory.slice(0, 100)));

  // Пробуем сохранить в Supabase
  try {
    await supabase.insert('reports', {
      id: Number(report.id), date: report.date, worker_name: report.workerName || '',
      dash_total: report.dashTotal, dash_cash: report.dashCash, dash_cashless: report.dashCashless,
      fact_total: report.factTotal, fact_cash: report.factCash, fact_cashless: report.factCashless,
      two_percent: report.twoPercent, difference: report.difference, expenses: report.expenses || [],
      goods_taken: report.goodsTaken || [], cash_taken_items: report.cashTakenItems || [],
      cleaner_amount: report.cleanerAmount || 0, transfers: report.transfers || 0, fine: report.fine || null,
    });
  } catch (e: any) {
    console.log('Save to Supabase failed, saved locally');
  }
};

export const getHistory = async (): Promise<SavedReport[]> => {
  // Сначала Supabase
  try {
    const data = await supabase.select('reports', 'select=*&order=created_at.desc&limit=200');
    if (data && data.length > 0) {
      // Обновляем локальный кэш
      await AsyncStorage.setItem('@local_history', JSON.stringify(data));
      return data.map(mapRowToReport);
    }
  } catch (e: any) {
    console.log('Supabase unavailable, using local cache');
  }

  // Fallback: локальный кэш
  return getLocalHistory();
};

const getLocalHistory = async (): Promise<SavedReport[]> => {
  try {
    const json = await AsyncStorage.getItem('@local_history');
    return json ? JSON.parse(json).map(mapRowToReport) : [];
  } catch {
    return [];
  }
};

const pickNumber = (row: any, snakeKey: string, camelKey: string): number => {
  return Number(row[snakeKey] ?? row[camelKey]) || 0;
};

const pickValue = <T>(row: any, snakeKey: string, camelKey: string, fallback: T): T => {
  return (row[snakeKey] ?? row[camelKey] ?? fallback) as T;
};

const mapRowToReport = (row: any): SavedReport => ({
  id: String(row.id),
  date: row.date,
  workerName: row.worker_name ?? row.workerName ?? '',
  dashTotal: pickNumber(row, 'dash_total', 'dashTotal'),
  dashCash: pickNumber(row, 'dash_cash', 'dashCash'),
  dashCashless: pickNumber(row, 'dash_cashless', 'dashCashless'),
  factTotal: pickNumber(row, 'fact_total', 'factTotal'),
  factCash: pickNumber(row, 'fact_cash', 'factCash'),
  factCashless: pickNumber(row, 'fact_cashless', 'factCashless'),
  transfers: pickNumber(row, 'transfers', 'transfers'),
  twoPercent: pickNumber(row, 'two_percent', 'twoPercent'),
  difference: pickNumber(row, 'difference', 'difference'),
  expenses: pickValue(row, 'expenses', 'expenses', []),
  goodsTaken: pickValue(row, 'goods_taken', 'goodsTaken', []),
  cashTakenItems: pickValue(row, 'cash_taken_items', 'cashTakenItems', []),
  cleanerAmount: pickNumber(row, 'cleaner_amount', 'cleanerAmount'),
  fine: row.fine || undefined,
  photoBase64: row.photoBase64 || undefined,
  salaryPaid: Boolean(row.salary_paid ?? row.salaryPaid),
});

export const getUnpaidReports = async (): Promise<SavedReport[]> => {
  try {
    const data = await supabase.select('reports', 'select=*&salary_paid=eq.false&order=created_at.desc&limit=50');
    if (data) return data.map(mapRowToReport);
  } catch (e: any) {}
  return [];
};

// ============================================================
// Сотрудники
// ============================================================
export const getWorkersFromSupabase = async (): Promise<any[]> => {
  try {
    return await supabase.select('workers', 'select=*&order=id.asc') || [];
  } catch { return []; }
};

export const getWorkersWithSettings = async (): Promise<any[]> => {
  try {
    return await supabase.select('workers', 'select=*&order=id.asc') || [];
  } catch { return []; }
};

export const updateWorkerSettings = async (
  workerId: string, baseSalary: number, calculatePercent: boolean, includeInSalary: boolean
): Promise<void> => {
  await supabase.update('workers', `id=eq.${workerId}`, {
    base_salary: baseSalary,
    calculate_percent: calculatePercent,
    include_in_salary: includeInSalary,
    updated_at: new Date().toISOString(),
  });
};

export const syncWorkersToSupabase = async (workers: any[]): Promise<void> => {
  if (!workers?.length) return;
  try {
    await supabase.upsert('workers', workers.map((w) => ({
      id: parseInt(w.id), phone: w.phone, first_name: w.firstName,
      last_name: w.lastName, middle_name: w.middleName, nickname: w.nickname,
      role: w.roles, updated_at: new Date().toISOString(),
    })));
  } catch {}
};

// ============================================================
// Штрафы
// ============================================================
export const saveFine = async (fine: FineRecord): Promise<void> => {
  try {
    await supabase.insert('fines', {
      id: parseInt(fine.id), worker_name: fine.workerName,
      amount: fine.amount, reason: fine.reason, date: fine.date, paid: fine.paid,
    });
  } catch {}
};

export const getUnpaidFines = async (workerName: string): Promise<FineRecord[]> => {
  try {
    const data = await supabase.select('fines', `select=*&worker_name=eq.${encodeURIComponent(workerName)}&paid=eq.false&order=created_at.desc`);
    return (data || []).map((f: any) => ({
      id: String(f.id), workerName: f.worker_name, amount: f.amount, reason: f.reason, date: f.date, paid: f.paid,
    }));
  } catch { return []; }
};

export const getAllUnpaidFines = async (): Promise<FineRecord[]> => {
  try {
    const data = await supabase.select('fines', 'select=*&paid=eq.false&order=created_at.desc');
    return (data || []).map((f: any) => ({
      id: String(f.id), workerName: f.worker_name, amount: f.amount, reason: f.reason, date: f.date, paid: f.paid,
    }));
  } catch { return []; }
};

// ============================================================
// Выплата зарплаты
// ============================================================
export const markSalaryPaid = async (reportIds: string[], workerName: string, fromDate: string, toDate: string): Promise<void> => {
  for (const id of reportIds) {
    try {
      await supabase.update('reports', `id=eq.${id}`, { salary_paid: true });
    } catch (e: any) {}
  }
};

// ============================================================
// Учётные данные
// ============================================================
export const saveCredentials = async (login: string, password: string): Promise<void> => {
  await AsyncStorage.setItem(CREDENTIALS_KEY, JSON.stringify({ login, password }));
};
export const getCredentials = async (): Promise<{ login: string; password: string } | null> => {
  const json = await AsyncStorage.getItem(CREDENTIALS_KEY);
  return json ? JSON.parse(json) : null;
};
export const removeCredentials = async (): Promise<void> => {
  await AsyncStorage.removeItem(CREDENTIALS_KEY);
};

// ============================================================
// Черновики
// ============================================================
export const saveDraft = async (draft: any): Promise<void> => {
  await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
};
export const getDraft = async (): Promise<any | null> => {
  const json = await AsyncStorage.getItem(DRAFT_KEY);
  return json ? JSON.parse(json) : null;
};
export const clearDraft = async (): Promise<void> => {
  await AsyncStorage.removeItem(DRAFT_KEY);
};
export const saveGoodsDraft = async (goods: any[]): Promise<void> => {
  await AsyncStorage.setItem(GOODS_DRAFT_KEY, JSON.stringify(goods));
};
export const getGoodsDraft = async (): Promise<any[] | null> => {
  const json = await AsyncStorage.getItem(GOODS_DRAFT_KEY);
  return json ? JSON.parse(json) : null;
};
export const clearGoodsDraft = async (): Promise<void> => {
  await AsyncStorage.removeItem(GOODS_DRAFT_KEY);
};

// Обновить отчёт
export const updateReport = async (reportId: string, data: any): Promise<void> => {
  await supabase.update('reports', `id=eq.${reportId}`, {
    ...data,
    updated_at: new Date().toISOString(),
  });
};

// Получить отчёт по ID
export const getReportById = async (reportId: string): Promise<SavedReport | null> => {
  const data = await supabase.select('reports', `select=*&id=eq.${reportId}`);
  if (data && data.length > 0) return mapRowToReport(data[0]);
  return null;
};

// Удалить отчёт
export const deleteReport = async (reportId: string): Promise<void> => {
  try {
    console.log('DELETE запрос для отчёта:', reportId);
    const url = `${SUPABASE_URL}/rest/v1/reports?id=eq.${reportId}`;
    console.log('URL:', url);
    
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    
    console.log('Статус ответа:', res.status);
    
    if (!res.ok) {
      const text = await res.text();
      console.log('Ошибка удаления:', text);
      throw new Error(text);
    }
    
    console.log('Отчёт успешно удалён');
  } catch (e: any) {
    console.log('Исключение при удалении:', e.message);
    throw e;
  }
};
