import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Switch, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { supabase } from '../utils/supabase';

const COLORS = {
  bg: '#1a1d23', card: '#21242b', border: '#2a2d35', text: '#e0e0e0', textDim: '#8b8d94', green: '#4caf93',
};

export interface ShiftSettings {
  showWorker: boolean; showDash: boolean; showFact: boolean;
  showGoodsTaken: boolean; showCashTaken: boolean; showFine: boolean;
  showOtherExpenses: boolean; showPhoto: boolean;
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

export default function SettingsScreen() {
  const [settings, setSettings] = useState<ShiftSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => { setLoading(true); const s = await getSettings(); setSettings(s); setLoading(false); };
  const toggle = async (key: keyof ShiftSettings) => {
    const updated = { ...settings, [key]: !settings[key] };
    setSettings(updated); setSaving(true); await saveSettings(updated); setSaving(false);
  };

  const items: { key: keyof ShiftSettings; label: string }[] = [
    { key: 'showWorker', label: 'Сотрудник' }, { key: 'showDash', label: 'Дэш (Терминал)' },
    { key: 'showFact', label: 'Факт' }, { key: 'showGoodsTaken', label: 'Взято товарами под зарплату' },
    { key: 'showCashTaken', label: 'Взято деньгами из кассы' }, { key: 'showFine', label: 'Штраф' },
    { key: 'showOtherExpenses', label: 'Прочие расходы' }, { key: 'showPhoto', label: 'Фото чека' },
  ];

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={COLORS.green} /><Text style={styles.loadingText}>Загрузка настроек...</Text></View>;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Настройки отображения</Text>
      <Text style={styles.subtitle}>Выберите, какие блоки показывать при сдаче смены</Text>
      {saving && <View style={styles.savingBanner}><Text style={styles.savingText}>Сохранение...</Text></View>}
      {items.map((item) => (
        <View key={item.key} style={styles.row}>
          <Text style={styles.label}>{item.label}</Text>
          <Switch value={settings[item.key]} onValueChange={() => toggle(item.key)} trackColor={{ false: COLORS.border, true: COLORS.green }} thumbColor={settings[item.key] ? '#fff' : '#888'} />
        </View>
      ))}
      <TouchableOpacity style={styles.resetBtn} onPress={() => {
        Alert.alert('Сброс', 'Вернуть все настройки по умолчанию?', [
          { text: 'Отмена', style: 'cancel' },
          { text: 'Сбросить', onPress: async () => { setSettings(defaultSettings); await saveSettings(defaultSettings); } },
        ]);
      }}><Text style={styles.resetText}>Сбросить настройки</Text></TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 16 },
  title: { color: COLORS.text, fontSize: 22, fontWeight: '700', marginBottom: 8 },
  subtitle: { color: COLORS.textDim, fontSize: 13, marginBottom: 20 },
  loading: { flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: COLORS.textDim, fontSize: 14, marginTop: 12 },
  savingBanner: { backgroundColor: COLORS.green + '30', borderRadius: 6, padding: 8, marginBottom: 12, alignItems: 'center' },
  savingText: { color: COLORS.green, fontSize: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border },
  label: { color: COLORS.text, fontSize: 15, flex: 1 },
  resetBtn: { marginTop: 20, backgroundColor: COLORS.card, borderRadius: 10, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  resetText: { color: COLORS.textDim, fontSize: 14 },
});