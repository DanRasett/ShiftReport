import AsyncStorage from '@react-native-async-storage/async-storage';
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
  showCleaner: boolean;
}

export interface CustomShiftItem {
  id: string;
  label: string;
}

const CUSTOM_SHIFT_ITEMS_KEY = '@custom_shift_items';

export const defaultSettings: ShiftSettings = {
  showWorker: true, showDash: true, showFact: true,
  showGoodsTaken: true, showCashTaken: true, showFine: true,
  showOtherExpenses: true, showPhoto: true, showCleaner: true,
};

export const getSettings = async (): Promise<ShiftSettings> => {
  try {
    const data = await supabase.select('settings', 'select=*&id=eq.1');
    if (data && data.length > 0) {
      const s = data[0];
      return {
        showWorker: s.show_worker ?? true, showDash: s.show_dash ?? true, showFact: s.show_fact ?? true,
        showGoodsTaken: s.show_goods_taken ?? true, showCashTaken: s.show_cash_taken ?? true, showFine: s.show_fine ?? true,
        showOtherExpenses: s.show_other_expenses ?? true, showPhoto: s.show_photo ?? true, showCleaner: s.show_cleaner ?? true,
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
      show_other_expenses: settings.showOtherExpenses, show_photo: settings.showPhoto, show_cleaner: settings.showCleaner,
      updated_at: new Date().toISOString(),
    });
  } catch (e) {}
};

export const getCustomShiftItems = async (): Promise<CustomShiftItem[]> => {
  try {
    const saved = await AsyncStorage.getItem(CUSTOM_SHIFT_ITEMS_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is CustomShiftItem => Boolean(item?.id && item?.label))
      : [];
  } catch {
    return [];
  }
};

export const saveCustomShiftItems = async (items: CustomShiftItem[]): Promise<void> => {
  await AsyncStorage.setItem(CUSTOM_SHIFT_ITEMS_KEY, JSON.stringify(items));
};
