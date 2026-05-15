import { supabase } from './supabase';

export interface ShiftSettings {
  showWorker: boolean;
  showDash: boolean;
  showFact: boolean;
  showGoodsTaken: boolean;
  showCashTaken: boolean;
  showFine: boolean;
  showOtherExpenses: boolean;
  showPhoto: boolean;
}

const defaultSettings: ShiftSettings = {
  showWorker: true, showDash: true, showFact: true,
  showGoodsTaken: true, showCashTaken: true, showFine: true,
  showOtherExpenses: true, showPhoto: true,
};

export const getSettings = async (): Promise<ShiftSettings> => {
  try {
    const data = await supabase.select('settings', 'select=*&id=eq.1');
    if (data && data.length > 0) {
      const s = data[0];
      return {
        showWorker: s.show_worker ?? true, showDash: s.show_dash ?? true, showFact: s.show_fact ?? true,
        showGoodsTaken: s.show_goods_taken ?? true, showCashTaken: s.show_cash_taken ?? true, showFine: s.show_fine ?? true,
        showOtherExpenses: s.show_other_expenses ?? true, showPhoto: s.show_photo ?? true,
      };
    }
  } catch (e) {}
  return defaultSettings;
};

export const saveSettings = async (settings: ShiftSettings): Promise<void> => {
  try {
    await supabase.upsert('settings', {
      id: 1,
      show_worker: settings.showWorker, show_dash: settings.showDash, show_fact: settings.showFact,
      show_goods_taken: settings.showGoodsTaken, show_cash_taken: settings.showCashTaken, show_fine: settings.showFine,
      show_other_expenses: settings.showOtherExpenses, show_photo: settings.showPhoto,
      updated_at: new Date().toISOString(),
    });
  } catch (e) {}
};