import AsyncStorage from '@react-native-async-storage/async-storage';
import { SavedReport, FineRecord } from '../types';
import { supabase } from './supabase';

const SUPABASE_URL = 'https://glilovtznlhiskipkrkk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsaWxvdnR6bmxoaXNraXBrcmtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzOTE0NjksImV4cCI6MjA5Mzk2NzQ2OX0.5JbTDMdq7wRoNPK54DD7j7KwWaZtJjGlWm1aD_xe_co';

const CREDENTIALS_KEY = '@smartshell_credentials';
const DRAFT_KEY = '@shift_draft';
const GOODS_DRAFT_KEY = '@goods_draft';

// ============================================================
// Отчёты
// ============================================================
export const saveReport = async (report: SavedReport): Promise<void> => {
  await supabase.insert('reports', {
    id: Number(report.id), date: report.date, worker_name: report.workerName || '',
    dash_total: report.dashTotal, dash_cash: report.dashCash, dash_cashless: report.dashCashless,
    fact_total: report.factTotal, fact_cash: report.factCash, fact_cashless: report.factCashless,
    two_percent: report.twoPercent, difference: report.difference, expenses: report.expenses || [],
    goods_taken: report.goodsTaken || [], cash_taken: report.cashTaken || 0, fine: report.fine || null,
  });
};

export const getHistory = async (): Promise<SavedReport[]> => {
  const data = await supabase.select('reports', 'select=*&order=created_at.desc&limit=200');
  return (data || []).map((row: any) => ({
    id: String(row.id), date: row.date, workerName: row.worker_name || '',
    dashTotal: Number(row.dash_total) || 0, dashCash: Number(row.dash_cash) || 0, dashCashless: Number(row.dash_cashless) || 0,
    factTotal: Number(row.fact_total) || 0, factCash: Number(row.fact_cash) || 0, factCashless: Number(row.fact_cashless) || 0,
    twoPercent: Number(row.two_percent) || 0, difference: Number(row.difference) || 0,
    expenses: row.expenses || [], goodsTaken: row.goods_taken || [], cashTaken: row.cash_taken || 0,
    fine: row.fine || undefined, photoBase64: undefined,
    salaryPaid: row.salary_paid || false, // ← добавили
  }));
};

export const getUnpaidReports = async (): Promise<SavedReport[]> => {
  const data = await supabase.select('reports', 'select=*&salary_paid=eq.false&order=created_at.desc&limit=500');
  return (data || []).map((row: any) => ({
    id: String(row.id), date: row.date, workerName: row.worker_name || '',
    dashTotal: Number(row.dash_total) || 0, dashCash: Number(row.dash_cash) || 0, dashCashless: Number(row.dash_cashless) || 0,
    factTotal: Number(row.fact_total) || 0, factCash: Number(row.fact_cash) || 0, factCashless: Number(row.fact_cashless) || 0,
    twoPercent: Number(row.two_percent) || 0, difference: Number(row.difference) || 0,
    expenses: row.expenses || [], goodsTaken: row.goods_taken || [], cashTaken: row.cash_taken || 0,
    fine: row.fine || undefined, photoBase64: undefined,
  }));
};

// ============================================================
// Сотрудники
// ============================================================
export const getWorkersFromSupabase = async (): Promise<any[]> => {
  return await supabase.select('workers', 'select=*&order=id.asc') || [];
};

export const syncWorkersToSupabase = async (workers: any[]): Promise<void> => {
  if (!workers?.length) return;
  await supabase.upsert('workers', workers.map((w) => ({
    id: parseInt(w.id), phone: w.phone, first_name: w.firstName,
    last_name: w.lastName, middle_name: w.middleName, nickname: w.nickname,
    role: w.roles, updated_at: new Date().toISOString(),
  })));
};

// ============================================================
// Штрафы
// ============================================================
export const saveFine = async (fine: FineRecord): Promise<void> => {
  await supabase.insert('fines', {
    id: parseInt(fine.id), worker_name: fine.workerName,
    amount: fine.amount, reason: fine.reason, date: fine.date, paid: fine.paid,
  });
};

export const getUnpaidFines = async (workerName: string): Promise<FineRecord[]> => {
  const data = await supabase.select('fines', `select=*&worker_name=eq.${encodeURIComponent(workerName)}&paid=eq.false&order=created_at.desc`);
  return (data || []).map((f: any) => ({
    id: String(f.id), workerName: f.worker_name, amount: f.amount, reason: f.reason, date: f.date, paid: f.paid,
  }));
};

// ============================================================
// Выплата зарплаты
// ============================================================
export const markSalaryPaid = async (reportIds: string[]): Promise<void> => {
  if (!reportIds.length) return;
  
  console.log('Обновляю отчёты:', reportIds);
  
  for (const id of reportIds) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/reports?id=eq.${id}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ salary_paid: true }),
      });
      console.log(`Отчёт ${id}: статус ${res.status}`);
    } catch (e: any) {
      console.log(`Ошибка обновления отчёта ${id}:`, e.message);
    }
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