import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { COLORS } from '../theme';
import {
  CustomShiftItem, ShiftSettings, defaultSettings, getCustomShiftItems,
  getSettings, saveCustomShiftItems, saveSettings,
} from '../utils/settings';

const visibilityItems: { key: keyof ShiftSettings; label: string }[] = [
  { key: 'showWorker', label: 'Сотрудник' },
  { key: 'showDash', label: 'Дэш / терминал' },
  { key: 'showFact', label: 'Фактическая касса' },
  { key: 'showGoodsTaken', label: 'Товары под зарплату' },
  { key: 'showCashTaken', label: 'Деньги из кассы' },
  { key: 'showFine', label: 'Штраф' },
  { key: 'showOtherExpenses', label: 'Прочие расходы' },
  { key: 'showPhoto', label: 'Фото чека' },
  { key: 'showCleaner', label: 'Уборщица' },
];

export default function SettingsScreen() {
  const [settings, setSettings] = useState<ShiftSettings>(defaultSettings);
  const [customItems, setCustomItems] = useState<CustomShiftItem[]>([]);
  const [newItemLabel, setNewItemLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([getSettings(), getCustomShiftItems()])
      .then(([savedSettings, savedItems]) => {
        setSettings(savedSettings);
        setCustomItems(savedItems);
      })
      .finally(() => setLoading(false));
  }, []);

  const toggle = async (key: keyof ShiftSettings) => {
    const updated = { ...settings, [key]: !settings[key] };
    setSettings(updated);
    setSaving(true);
    await saveSettings(updated);
    setSaving(false);
  };

  const addCustomItem = async () => {
    const label = newItemLabel.trim();
    if (!label) {
      Alert.alert('Введите название', 'Например: Комментарий администратора');
      return;
    }
    if (customItems.some(item => item.label.toLowerCase() === label.toLowerCase())) {
      Alert.alert('Такой пункт уже есть');
      return;
    }
    const updated = [...customItems, { id: `${Date.now()}`, label }];
    setCustomItems(updated);
    setNewItemLabel('');
    await saveCustomShiftItems(updated);
  };

  const removeCustomItem = async (id: string) => {
    const updated = customItems.filter(item => item.id !== id);
    setCustomItems(updated);
    await saveCustomShiftItems(updated);
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.green} />
        <Text style={styles.loadingText}>Загружаем настройки</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>КОНФИГУРАЦИЯ</Text>
        <Text style={styles.title}>Настройки смены</Text>
        <Text style={styles.subtitle}>Настройте состав формы под рабочий процесс команды.</Text>
      </View>

      {saving && <Text style={styles.savingText}>Изменения сохраняются</Text>}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionIndex}>01</Text>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Стандартные блоки</Text>
            <Text style={styles.sectionDescription}>Показывать в форме сдачи смены</Text>
          </View>
        </View>
        {visibilityItems.map((item, index) => (
          <View key={item.key} style={[styles.row, index === visibilityItems.length - 1 && styles.rowLast]}>
            <Text style={styles.label}>{item.label}</Text>
            <Switch
              value={settings[item.key]}
              onValueChange={() => toggle(item.key)}
              trackColor={{ false: COLORS.border, true: COLORS.greenStrong }}
              thumbColor={settings[item.key] ? COLORS.text : COLORS.textDim}
            />
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionIndex}>02</Text>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Свои пункты</Text>
            <Text style={styles.sectionDescription}>Текстовые поля для дополнительной информации</Text>
          </View>
        </View>

        <View style={styles.addRow}>
          <TextInput
            style={styles.input}
            value={newItemLabel}
            onChangeText={setNewItemLabel}
            onSubmitEditing={addCustomItem}
            placeholder="Название нового пункта"
            placeholderTextColor={COLORS.textDim}
            returnKeyType="done"
          />
          <TouchableOpacity style={styles.addButton} onPress={addCustomItem}>
            <Text style={styles.addButtonText}>Добавить</Text>
          </TouchableOpacity>
        </View>

        {customItems.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Пунктов пока нет</Text>
            <Text style={styles.emptyText}>Добавленные поля появятся в форме «Сдача смены».</Text>
          </View>
        ) : (
          customItems.map((item, index) => (
            <View key={item.id} style={[styles.customRow, index === customItems.length - 1 && styles.rowLast]}>
              <View style={styles.customNumber}><Text style={styles.customNumberText}>{String(index + 1).padStart(2, '0')}</Text></View>
              <Text style={styles.customLabel}>{item.label}</Text>
              <TouchableOpacity style={styles.removeButton} onPress={() => removeCustomItem(item.id)}>
                <Text style={styles.removeButtonText}>Удалить</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      <TouchableOpacity
        style={styles.resetButton}
        onPress={() => Alert.alert('Сбросить настройки?', 'Все стандартные блоки снова будут включены.', [
          { text: 'Отмена', style: 'cancel' },
          {
            text: 'Сбросить',
            style: 'destructive',
            onPress: async () => {
              setSettings(defaultSettings);
              await saveSettings(defaultSettings);
            },
          },
        ])}
      >
        <Text style={styles.resetButtonText}>Сбросить стандартные настройки</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 20, paddingBottom: 48 },
  loading: { flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: COLORS.textDim, fontSize: 13, marginTop: 12 },
  hero: { paddingVertical: 18, marginBottom: 20 },
  eyebrow: { color: COLORS.green, fontSize: 11, fontWeight: '800', letterSpacing: 2.2, marginBottom: 10 },
  title: { color: COLORS.text, fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.8 },
  subtitle: { color: COLORS.textDim, fontSize: 14, lineHeight: 21, maxWidth: 440, marginTop: 8 },
  savingText: { color: COLORS.green, fontSize: 12, marginBottom: 12 },
  section: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', padding: 18, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  sectionIndex: { color: COLORS.green, fontSize: 11, fontWeight: '800', marginRight: 14, paddingTop: 3 },
  sectionHeading: { flex: 1 },
  sectionTitle: { color: COLORS.text, fontSize: 17, fontWeight: '700' },
  sectionDescription: { color: COLORS.textDim, fontSize: 12, lineHeight: 18, marginTop: 3 },
  row: { minHeight: 58, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rowLast: { borderBottomWidth: 0 },
  label: { color: COLORS.text, fontSize: 14, flex: 1 },
  addRow: { flexDirection: 'row', gap: 8, padding: 18, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  input: { flex: 1, minHeight: 46, backgroundColor: COLORS.inputBg, borderWidth: 1, borderColor: COLORS.borderStrong, color: COLORS.text, paddingHorizontal: 14, fontSize: 14 },
  addButton: { minHeight: 46, justifyContent: 'center', backgroundColor: COLORS.green, paddingHorizontal: 18 },
  addButtonText: { color: COLORS.bg, fontSize: 13, fontWeight: '800' },
  emptyState: { padding: 24 },
  emptyTitle: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  emptyText: { color: COLORS.textDim, fontSize: 12, lineHeight: 18, marginTop: 5 },
  customRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  customNumber: { width: 30 },
  customNumberText: { color: COLORS.green, fontSize: 11, fontWeight: '800' },
  customLabel: { flex: 1, color: COLORS.text, fontSize: 14 },
  removeButton: { paddingVertical: 8, paddingLeft: 16 },
  removeButtonText: { color: COLORS.red, fontSize: 12, fontWeight: '700' },
  resetButton: { borderWidth: 1, borderColor: COLORS.border, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  resetButtonText: { color: COLORS.textDim, fontSize: 13, fontWeight: '600' },
});
