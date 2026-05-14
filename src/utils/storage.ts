import AsyncStorage from '@react-native-async-storage/async-storage';
import { SavedReport } from '../types';
import { supabase } from './supabase';
import { FineRecord } from '../types';

const HISTORY_KEY = '@shift_history';
const CREDENTIALS_KEY = '@smartshell_credentials';
const DRAFT_KEY = '@shift_draft';
const GOODS_DRAFT_KEY = '@goods_draft';

// ============================================================
// Отчёты (Supabase + локальный fallback)
// ============================================================
export const saveReport = async (report: SavedReport): Promise<void> => {
  const history = await getLocalHistory();
  history.unshift(report);
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));

  try {
    const { error } = await supabase.from('reports').insert({
      id: Number(report.id),
      date: report.date,
      worker_name: report.workerName || '',
      dash_total: report.dashTotal,
      dash_cash: report.dashCash,
      dash_cashless: report.dashCashless,
      fact_total: report.factTotal,
      fact_cash: report.factCash,
      fact_cashless: report.factCashless,
      two_percent: report.twoPercent,
      difference: report.difference,
      expenses: report.expenses || [],
      goods_taken: report.goodsTaken || [],
      cash_taken: report.cashTaken || 0,
      fine: report.fine || null,
    });

    if (error) console.log('Supabase: сохранение не удалось');
    else console.log('Supabase: отчёт сохранён');
  } catch (e) {
    console.log('Supabase: нет соединения');
  }
};

export const getHistory = async (): Promise<SavedReport[]> => {
  try {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (!error && data && data.length > 0) {
      return data.map(mapRowToReport);
    }
  } catch (e) {}

  return getLocalHistory();
};

export const getHistoryByWorker = async (
  workerName: string,
  from: string,
  to: string
): Promise<SavedReport[]> => {
  try {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('worker_name', workerName)
      .gte('date', from)
      .lte('date', to + 'T23:59:59')
      .order('created_at', { ascending: false });

    if (!error && data) return data.map(mapRowToReport);
  } catch (e) {}

  const history = await getLocalHistory();
  return history.filter((r) => {
    const date = new Date(r.date);
    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59);
    return r.workerName === workerName && date >= fromDate && date <= toDate;
  });
};

const getLocalHistory = async (): Promise<SavedReport[]> => {
  const json = await AsyncStorage.getItem(HISTORY_KEY);
  return json ? JSON.parse(json) : [];
};

const mapRowToReport = (row: any): SavedReport => ({
  id: String(row.id),
  date: row.date,
  workerName: row.worker_name || '',
  dashTotal: Number(row.dash_total) || 0,
  dashCash: Number(row.dash_cash) || 0,
  dashCashless: Number(row.dash_cashless) || 0,
  factTotal: Number(row.fact_total) || 0,
  factCash: Number(row.fact_cash) || 0,
  factCashless: Number(row.fact_cashless) || 0,
  twoPercent: Number(row.two_percent) || 0,
  difference: Number(row.difference) || 0,
  expenses: row.expenses || [],
  goodsTaken: row.goods_taken || [],
  cashTaken: row.cash_taken || 0,
  fine: row.fine || undefined,
  photoBase64: undefined,
});

// ============================================================
// Синхронизация сотрудников с Supabase
// ============================================================
export const syncWorkersToSupabase = async (workers: any[]): Promise<void> => {
  if (!workers || workers.length === 0) return;

  try {
    const { error } = await supabase
      .from('workers')
      .upsert(
        workers.map((w) => ({
          id: parseInt(w.id),
          phone: w.phone,
          first_name: w.firstName,
          last_name: w.lastName,
          middle_name: w.middleName,
          nickname: w.nickname,
          role: w.roles,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: 'id' }
      );

    if (error) {
      console.error('Ошибка синхронизации сотрудников с Supabase:', error.message);
    } else {
      console.log('Сотрудники успешно синхронизированы с Supabase');
    }
  } catch (e: any) {
    console.error('Исключение при синхронизации сотрудников:', e?.message);
  }
};

export const getWorkersFromSupabase = async (): Promise<any[]> => {
  try {
    const { data, error } = await supabase
      .from('workers')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      console.error('Ошибка загрузки сотрудников из Supabase:', error.message);
      return [];
    }

    return data || [];
  } catch (e: any) {
    console.error('Исключение при загрузке сотрудников:', e?.message);
    return [];
  }
};

// Сохранить штраф
export const saveFine = async (fine: FineRecord): Promise<void> => {
  try {
    const { error } = await supabase.from('fines').insert({
      id: parseInt(fine.id),
      worker_name: fine.workerName,
      amount: fine.amount,
      reason: fine.reason,
      date: fine.date,
      paid: fine.paid,
    });
    if (error) console.log('Ошибка сохранения штрафа:', error.message);
    else console.log('Штраф сохранён');
  } catch (e: any) {
    console.log('Исключение при сохранении штрафа:', e?.message);
  }
};

// Получить неоплаченные штрафы сотрудника
export const getUnpaidFines = async (workerName: string): Promise<FineRecord[]> => {
  try {
    const { data, error } = await supabase
      .from('fines')
      .select('*')
      .eq('worker_name', workerName)
      .eq('paid', false)
      .order('created_at', { ascending: false });

    if (error) return [];
    return (data || []).map((f: any) => ({
      id: String(f.id),
      workerName: f.worker_name,
      amount: f.amount,
      reason: f.reason,
      date: f.date,
      paid: f.paid,
    }));
  } catch (e) {
    return [];
  }
};

// Получить все неоплаченные штрафы
export const getAllUnpaidFines = async (): Promise<FineRecord[]> => {
  try {
    const { data, error } = await supabase
      .from('fines')
      .select('*')
      .eq('paid', false)
      .order('created_at', { ascending: false });

    if (error) return [];
    return (data || []).map((f: any) => ({
      id: String(f.id),
      workerName: f.worker_name,
      amount: f.amount,
      reason: f.reason,
      date: f.date,
      paid: f.paid,
    }));
  } catch (e) {
    return [];
  }
};

// ============================================================
// Учётные данные SmartShell
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
// Черновик смены
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

// ============================================================
// Черновик товаров
// ============================================================
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