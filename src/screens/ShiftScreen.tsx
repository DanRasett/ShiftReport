import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Image,
  ActionSheetIOS,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Sharing from 'expo-sharing';
import { supabase } from '../utils/supabase';
import { ShiftForm, SavedReport, FineRecord } from '../types';
import { calculateShift } from '../utils/calculations';
import { saveDraft, getDraft, clearDraft, getWorkersFromSupabase, saveFine, getUnpaidFines } from '../utils/storage';
import {
  getShiftData,
  isShellLoggedIn,
  getCurrentWorker,
  getGoodsWithPrices,
  getUserRole,
} from '../utils/smartshell';
import { useAuth } from '../utils/AuthContext';
import PickerModal from '../components/PickerModal';
import { getSettings, ShiftSettings } from './SettingsScreen';

const COLORS = {
  bg: '#1a1d23',
  card: '#21242b',
  border: '#2a2d35',
  text: '#e0e0e0',
  textDim: '#8b8d94',
  green: '#4caf93',
  greenBg: '#1a2a24',
  red: '#e0556a',
  redBg: '#2a1a1e',
  inputBg: '#282c34',
};

const formatNum = (n: number) => n.toLocaleString('ru-RU');

const getLocalHistoryDirect = async (): Promise<SavedReport[]> => {
  const json = await AsyncStorage.getItem('@shift_history');
  return json ? JSON.parse(json) : [];
};

const buildReportText = (
  form: ShiftForm,
  calc: ReturnType<typeof calculateShift>,
  workerName: string,
  goodsTaken: { name: string; quantity: string; price: string }[],
  cashTaken: string,
  cashTakenWorkerName: string,
  fineAmount: string,
  fineReason: string,
  isManager: boolean
) => {
  const expensesText = form.expenses
    .filter((e) => e.name.trim() || e.description.trim())
    .map((e) => `${e.name}: ${e.description}`)
    .join('\n');

  const goodsText = goodsTaken
    .filter((g) => g.name.trim())
    .map((g) => `${g.name} ×${g.quantity || '0'} = ${formatNum((parseInt(g.quantity) || 0) * (parseInt(g.price) || 0))} ₽`)
    .join('\n');

  const diffText =
    calc.difference > 0
      ? `Пересдача: +${formatNum(calc.difference)} ₽`
      : calc.difference < 0
      ? `Недосдача: ${formatNum(calc.difference)} ₽`
      : `0 ₽ (сходится)`;

  const percentLabel = calc.dashTotal > 10000 ? '3%' : '2%';

  let text = `Сдача смены
Сотрудник: ${workerName || '—'}
---
Дэш: ${formatNum(calc.dashTotal)}
Нал: ${formatNum(parseFloat(form.dashCash) || 0)}
Карта: ${formatNum(parseFloat(form.dashCashless) || 0)}
---
Факт: ${formatNum(calc.factTotal)}
Нал: ${formatNum(parseFloat(form.factCash) || 0)}
Карта: ${formatNum(parseFloat(form.factCashless) || 0)}
---
Взято товарами:
${goodsText || '—'}
Взято деньгами: ${cashTakenWorkerName || '—'} — ${cashTaken ? formatNum(parseInt(cashTaken)) : '0'} ₽
---
Расходы (старые):
${expensesText || '—'}`;

  if (isManager) {
    text += `
---
Штраф: ${fineAmount ? formatNum(parseInt(fineAmount)) + ' ₽ — ' + (fineReason || 'Не указана') : 'Нет'}`;
  }

  text += `
---
${percentLabel}: ${formatNum(calc.twoPercent)}
---
${diffText}`;

  return text;
};

export default function ShiftScreen() {
  const { isLoggedIn } = useAuth();

  const [form, setForm] = useState<ShiftForm>({
    dashCash: '',
    dashCashless: '',
    factCash: '',
    factCashless: '',
    expenses: [{ id: '1', name: '', description: '' }],
  });

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [smartShellLoaded, setSmartShellLoaded] = useState(false);
  const [workerName, setWorkerName] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [goodsTaken, setGoodsTaken] = useState<{ name: string; quantity: string; price: string }[]>([
    { name: '', quantity: '', price: '' },
  ]);
  const [cashTaken, setCashTaken] = useState('');
  const [cashTakenWorker, setCashTakenWorker] = useState<{ id: string; name: string } | null>(null);
  const [fineAmount, setFineAmount] = useState('');
  const [fineReason, setFineReason] = useState('');
  const [settings, setSettings] = useState<ShiftSettings | null>(null);
  const [isActiveOperator, setIsActiveOperator] = useState(false);
  const [unpaidFines, setUnpaidFines] = useState<FineRecord[]>([]);

  const [workers, setWorkers] = useState<{ id: string; name: string }[]>([]);
  const [goodsList, setGoodsList] = useState<{ id: string; title: string; cost: number }[]>([]);
  const [showWorkerPicker, setShowWorkerPicker] = useState(false);
  const [showGoodsPicker, setShowGoodsPicker] = useState(false);
  const [showCashWorkerPicker, setShowCashWorkerPicker] = useState(false);
  const [currentGoodsIndex, setCurrentGoodsIndex] = useState<number | null>(null);
  const userRoles = useRef<string[]>([]);

  const calc = calculateShift(form);

  const isManager = () => userRoles.current.some(r =>
    r.toLowerCase().includes('manager') || r.toLowerCase().includes('owner') || r.toLowerCase().includes('admin')
  );

  const showAllBlocks = !isManager() || isActiveOperator;

  useEffect(() => {
    loadDraft();
    loadShiftSettings();
  }, []);

  const loadDraft = async () => {
    const draft = await getDraft();
    if (draft) {
      if (draft.form) setForm(draft.form);
      if (draft.workerName) setWorkerName(draft.workerName);
      if (draft.goodsTaken) setGoodsTaken(draft.goodsTaken);
      if (draft.cashTaken) setCashTaken(draft.cashTaken);
      if (draft.cashTakenWorker) setCashTakenWorker(draft.cashTakenWorker);
      if (draft.fineAmount) setFineAmount(draft.fineAmount);
      if (draft.fineReason) setFineReason(draft.fineReason);
    }
  };

  const loadShiftSettings = async () => {
    const s = await getSettings();
    setSettings(s);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      saveDraft({
        form, workerName, goodsTaken, cashTaken,
        cashTakenWorker, fineAmount, fineReason,
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [form, workerName, goodsTaken, cashTaken, cashTakenWorker, fineAmount, fineReason]);

  useEffect(() => {
    if (isLoggedIn && isShellLoggedIn()) {
      fetchAllData();
      setAutoRefresh(true);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (!autoRefresh || !isShellLoggedIn()) return;

    const interval = setInterval(async () => {
      try {
        const data = await getShiftData();
        if (data) {
          setForm((prev) => ({
            ...prev,
            dashCash: String(data.cash),
            dashCashless: String(data.cashless),
          }));
        }
      } catch (e) {}
    }, 3000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const fetchAllData = async () => {
    try {
      const [data, supabaseWorkers, roles, goods] = await Promise.all([
        getShiftData(),
        getWorkersFromSupabase(),
        getUserRole(),
        getGoodsWithPrices(),
      ]);

      if (data) {
        setForm((prev) => ({ ...prev, dashCash: String(data.cash), dashCashless: String(data.cashless) }));
        setSmartShellLoaded(true);
      }

      setWorkers(supabaseWorkers.map((w: any) => ({
        id: String(w.id),
        name: [w.first_name, w.last_name].filter(Boolean).join(' ') || w.nickname || String(w.id),
      })));

      userRoles.current = roles;
      setIsActiveOperator(roles.some(r => r.toLowerCase().includes('active_operator')));

      const activeOperator = supabaseWorkers.find((w: any) =>
        w.role && w.role.toLowerCase().includes('active_operator')
      );

      if (activeOperator) {
        const fullName = [activeOperator.first_name, activeOperator.last_name].filter(Boolean).join(' ');
        if (fullName) {
          setWorkerName(fullName);
          getUnpaidFines(fullName).then(setUnpaidFines);
        }
      } else {
        const worker = await getCurrentWorker();
        if (worker) {
          setWorkerName(worker);
          getUnpaidFines(worker).then(setUnpaidFines);
        }
      }

      setGoodsList(goods);
    } catch (error) {}
  };

  const updateExpense = (id: string, field: 'name' | 'description', value: string) => {
    setForm((prev) => {
      const expenses = prev.expenses.map((e) => (e.id === id ? { ...e, [field]: value } : e));
      const last = expenses[expenses.length - 1];
      if (last.name.trim() || last.description.trim()) expenses.push({ id: String(Date.now()), name: '', description: '' });
      return { ...prev, expenses };
    });
  };

  const removeExpense = (id: string) => {
    setForm((prev) => {
      const expenses = prev.expenses.filter((e) => e.id !== id);
      if (expenses.length === 0) expenses.push({ id: String(Date.now()), name: '', description: '' });
      return { ...prev, expenses };
    });
  };

  const addGoodsTaken = () => setGoodsTaken([...goodsTaken, { name: '', quantity: '', price: '' }]);
  const updateGoodsTaken = (index: number, field: string, value: string) => {
    setGoodsTaken((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };
  const removeGoodsTaken = (index: number) => {
    setGoodsTaken((prev) => prev.filter((_, i) => i !== index));
  };

  const selectWorker = async (item: { id: string; label: string }) => {
    setWorkerName(item.label);
    setShowWorkerPicker(false);
    getUnpaidFines(item.label).then(setUnpaidFines);
  };

  const selectGoodsItem = (item: { id: string; label: string; sublabel?: string }) => {
    if (currentGoodsIndex !== null) {
      const goods = goodsList.find(g => g.id === item.id);
      updateGoodsTaken(currentGoodsIndex, 'name', item.label);
      if (goods) updateGoodsTaken(currentGoodsIndex, 'price', String(goods.cost));
      setCurrentGoodsIndex(null);
    }
    setShowGoodsPicker(false);
  };

  const selectCashWorker = (item: { id: string; label: string }) => {
    setCashTakenWorker({ id: item.id, name: item.label });
    setShowCashWorkerPicker(false);
  };

  const openGoodsPicker = (index: number) => {
    setCurrentGoodsIndex(index);
    setShowGoodsPicker(true);
  };

  const handleIssueFine = async () => {
    const amount = parseInt(fineAmount) || 0;
    if (amount <= 0) { Alert.alert('Ошибка', 'Введите сумму штрафа'); return; }
    if (!workerName.trim()) { Alert.alert('Ошибка', 'Выберите сотрудника'); return; }

    const fine: FineRecord = {
      id: String(Date.now()),
      workerName,
      amount,
      reason: fineReason || 'Не указана',
      date: new Date().toISOString(),
      paid: false,
    };

    await saveFine(fine);
    getUnpaidFines(workerName).then(setUnpaidFines);
    setFineAmount('');
    setFineReason('');
    Alert.alert('Готово', `Штраф ${amount} ₽ выписан сотруднику ${workerName}`);
  };

  const pickFromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Нет доступа', 'Разрешите доступ к камере в настройках'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.3, base64: true });
    if (!result.canceled && result.assets[0]) {
      const manipulated = await ImageManipulator.manipulateAsync(
        result.assets[0].uri, [{ resize: { width: 400 } }], { compress: 0.3, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      setPhotoUri(manipulated.uri); setPhotoBase64(manipulated.base64 || null);
    }
  };

  const pickFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Нет доступа', 'Разрешите доступ к галерее в настройках'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.3, base64: true });
    if (!result.canceled && result.assets[0]) {
      const manipulated = await ImageManipulator.manipulateAsync(
        result.assets[0].uri, [{ resize: { width: 400 } }], { compress: 0.3, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      setPhotoUri(manipulated.uri); setPhotoBase64(manipulated.base64 || null);
    }
  };

  const showPhotoOptions = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Камера', 'Галерея', 'Отмена'], cancelButtonIndex: 2 },
        (index) => { if (index === 0) pickFromCamera(); if (index === 1) pickFromGallery(); }
      );
    } else {
      Alert.alert('Фото чека', 'Выберите источник', [
        { text: 'Камера', onPress: pickFromCamera },
        { text: 'Галерея', onPress: pickFromGallery },
        { text: 'Отмена', style: 'cancel' },
      ]);
    }
  };

  const handleShare = async () => {
    if (!form.factCash && !form.factCashless) { Alert.alert('Ошибка', 'Заполните хотя бы Факт'); return; }
    setSending(true);
    setAutoRefresh(false);

    const text = buildReportText(form, calc, workerName, goodsTaken, cashTaken, cashTakenWorker?.name || '', fineAmount, fineReason, isManager());
    const filledExpenses = form.expenses.filter((e) => e.name.trim() || e.description.trim());
    const reportId = Date.now() * 1000 + Math.floor(Math.random() * 1000);

    const report: SavedReport = {
      id: String(reportId),
      date: new Date().toISOString(),
      workerName,
      dashTotal: calc.dashTotal,
      dashCash: parseFloat(form.dashCash) || 0,
      dashCashless: parseFloat(form.dashCashless) || 0,
      factTotal: calc.factTotal,
      factCash: parseFloat(form.factCash) || 0,
      factCashless: parseFloat(form.factCashless) || 0,
      expenses: filledExpenses.map((e) => ({ name: e.name, description: e.description })),
      twoPercent: calc.twoPercent,
      difference: calc.difference,
      photoBase64: photoBase64 || undefined,
      goodsTaken: goodsTaken.filter((g) => g.name.trim()).map((g) => ({ name: g.name, quantity: parseInt(g.quantity) || 0, price: parseInt(g.price) || 0 })),
      cashTaken: parseInt(cashTaken) || 0,
      fine: isManager() && parseInt(fineAmount) > 0 ? { amount: parseInt(fineAmount), reason: fineReason || 'Не указана' } : undefined,
    };

    try {
      const history = await getLocalHistoryDirect();
      history.unshift(report);
      await AsyncStorage.setItem('@shift_history', JSON.stringify(history));
      await clearDraft();
    } catch (e) {}

    setTimeout(() => {
      supabase.from('reports').insert({
        id: reportId, date: report.date, worker_name: report.workerName || '',
        dash_total: report.dashTotal, dash_cash: report.dashCash, dash_cashless: report.dashCashless,
        fact_total: report.factTotal, fact_cash: report.factCash, fact_cashless: report.factCashless,
        two_percent: report.twoPercent, difference: report.difference, expenses: report.expenses || [],
        goods_taken: report.goodsTaken || [], cash_taken: report.cashTaken || 0, fine: report.fine || null,
      }).then(({ error }: any) => { if (error) console.log('Supabase:', error.message); });
    }, 100);

    setTimeout(async () => {
      try {
        if (photoUri) {
          await Sharing.shareAsync(photoUri, { mimeType: 'image/jpeg', dialogTitle: text });
        } else {
          const { Share } = require('react-native');
          await Share.share({ message: text });
        }
      } catch (error: any) { if (error?.message !== 'User did not share') console.error('Ошибка отправки:', error); }
    }, 300);

    setForm({ dashCash: '', dashCashless: '', factCash: '', factCashless: '', expenses: [{ id: String(Date.now()), name: '', description: '' }] });
    setPhotoUri(null); setPhotoBase64(null);
    setGoodsTaken([{ name: '', quantity: '', price: '' }]); setCashTaken(''); setCashTakenWorker(null);
    setFineAmount(''); setFineReason('');
    setSending(false);

    setTimeout(() => { setAutoRefresh(true); fetchAllData(); }, 2000);
  };

  const differenceLabel = calc.difference > 0 ? `Пересдача: +${formatNum(calc.difference)} ₽` : calc.difference < 0 ? `Недосдача: ${formatNum(calc.difference)} ₽` : `0 ₽ (сходится)`;
  const diffColor = calc.difference >= 0 ? COLORS.green : COLORS.red;
  const diffBg = calc.difference >= 0 ? COLORS.greenBg : COLORS.redBg;
  const percentLabel = calc.dashTotal > 10000 ? '3%' : '2%';

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      {settings?.showWorker !== false && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Сотрудник</Text>
          <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowWorkerPicker(true)}>
            <Text style={[styles.pickerBtnText, !workerName && { color: COLORS.textDim }]}>{workerName || 'Выберите сотрудника'}</Text>
            <Text style={styles.pickerArrow}>▼</Text>
          </TouchableOpacity>
        </View>
      )}

      {settings?.showDash !== false && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Дэш (Терминал)</Text>
          <View style={styles.row}>
            <View style={styles.field}><Text style={styles.label}>Нал</Text><TextInput style={styles.input} keyboardType="numeric" placeholder="0" placeholderTextColor={COLORS.textDim} value={form.dashCash} onChangeText={(v) => setForm({ ...form, dashCash: v })} /></View>
            <View style={styles.field}><Text style={styles.label}>Карта</Text><TextInput style={styles.input} keyboardType="numeric" placeholder="0" placeholderTextColor={COLORS.textDim} value={form.dashCashless} onChangeText={(v) => setForm({ ...form, dashCashless: v })} /></View>
          </View>
          <Text style={styles.totalRow}>Итого Дэш: <Text style={styles.totalNum}>{formatNum(calc.dashTotal)} ₽</Text></Text>
          {!smartShellLoaded && isLoggedIn && <TouchableOpacity style={styles.smartShellBtn} onPress={fetchAllData}><Text style={styles.smartShellBtnText}>📡 Загрузить из SmartShell</Text></TouchableOpacity>}
          {smartShellLoaded && <View style={styles.loadedBadge}><Text style={styles.loadedBadgeText}>✓ SmartShell</Text></View>}
        </View>
      )}

      {isManager() && !isActiveOperator && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Выписать штраф</Text>
          <View style={styles.row}>
            <View style={styles.field}>
              <Text style={styles.label}>Сумма</Text>
              <TextInput style={styles.input} keyboardType="numeric" placeholder="0" placeholderTextColor={COLORS.textDim} value={fineAmount} onChangeText={setFineAmount} />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Причина</Text>
              <TextInput style={styles.input} placeholder="За что" placeholderTextColor={COLORS.textDim} value={fineReason} onChangeText={setFineReason} />
            </View>
          </View>
          <TouchableOpacity style={[styles.shareBtn, { marginTop: 12 }]} onPress={handleIssueFine}>
            <Text style={styles.shareBtnText}>Выписать штраф</Text>
          </TouchableOpacity>

          {unpaidFines.length > 0 && (
            <View style={styles.finesList}>
              <Text style={styles.finesTitle}>Неоплаченные штрафы:</Text>
              {unpaidFines.map((f) => (
                <View key={f.id} style={styles.fineRow}>
                  <Text style={styles.fineText}>
                    {new Date(f.date).toLocaleDateString('ru-RU')} | {formatNum(f.amount)} ₽ | {f.reason}
                  </Text>
                </View>
              ))}
              <View style={styles.fineTotal}>
                <Text style={styles.fineTotalText}>
                  Итого: {formatNum(unpaidFines.reduce((s, f) => s + f.amount, 0))} ₽
                </Text>
              </View>
            </View>
          )}
        </View>
      )}

      {showAllBlocks && (
        <>
          {settings?.showFact !== false && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Факт</Text>
              <View style={styles.row}>
                <View style={styles.field}><Text style={styles.label}>Нал</Text><TextInput style={styles.input} keyboardType="numeric" placeholder="0" placeholderTextColor={COLORS.textDim} value={form.factCash} onChangeText={(v) => setForm({ ...form, factCash: v })} /></View>
                <View style={styles.field}><Text style={styles.label}>Карта</Text><TextInput style={styles.input} keyboardType="numeric" placeholder="0" placeholderTextColor={COLORS.textDim} value={form.factCashless} onChangeText={(v) => setForm({ ...form, factCashless: v })} /></View>
              </View>
              <Text style={styles.totalRow}>Итого Факт: <Text style={styles.totalNum}>{formatNum(calc.factTotal)} ₽</Text></Text>
            </View>
          )}

          {settings?.showGoodsTaken !== false && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Взято товарами под зарплату</Text>
              {goodsTaken.map((item, index) => (
                <View key={index} style={styles.expenseRow}>
                  <TouchableOpacity style={styles.pickerField} onPress={() => openGoodsPicker(index)}>
                    <Text style={[styles.pickerText, !item.name && { color: COLORS.textDim }]}>{item.name || 'Товар'}</Text>
                  </TouchableOpacity>
                  <View style={styles.expenseSmall}><TextInput style={styles.input} placeholder="Кол-во" keyboardType="numeric" value={item.quantity} onChangeText={(v) => updateGoodsTaken(index, 'quantity', v)} /></View>
                  <View style={styles.expenseSmall}><TextInput style={styles.input} placeholder="Цена" keyboardType="numeric" value={item.price} editable={false} /></View>
                  <TouchableOpacity style={styles.removeBtn} onPress={() => removeGoodsTaken(index)}><Text style={styles.removeBtnText}>✕</Text></TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={styles.addBtn} onPress={addGoodsTaken}><Text style={styles.addBtnText}>+ Добавить товар</Text></TouchableOpacity>
            </View>
          )}

          {settings?.showCashTaken !== false && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Взято деньгами из кассы</Text>
              <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowCashWorkerPicker(true)}>
                <Text style={[styles.pickerBtnText, !cashTakenWorker && { color: COLORS.textDim }]}>{cashTakenWorker ? cashTakenWorker.name : 'Кто взял'}</Text>
                <Text style={styles.pickerArrow}>▼</Text>
              </TouchableOpacity>
              <TextInput style={[styles.input, { marginTop: 8 }]} keyboardType="numeric" placeholder="Сумма" placeholderTextColor={COLORS.textDim} value={cashTaken} onChangeText={setCashTaken} />
            </View>
          )}

          {settings?.showFine !== false && isManager() && isActiveOperator && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Штраф</Text>
              <View style={styles.row}>
                <View style={styles.field}><Text style={styles.label}>Сумма</Text><TextInput style={styles.input} keyboardType="numeric" placeholder="0" placeholderTextColor={COLORS.textDim} value={fineAmount} onChangeText={setFineAmount} /></View>
                <View style={styles.field}><Text style={styles.label}>Причина</Text><TextInput style={styles.input} placeholder="За что" placeholderTextColor={COLORS.textDim} value={fineReason} onChangeText={setFineReason} /></View>
              </View>
            </View>
          )}

          {settings?.showOtherExpenses !== false && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Прочие расходы</Text>
              {form.expenses.map((expense, index) => {
                const isLast = index === form.expenses.length - 1;
                const hasContent = expense.name.trim() || expense.description.trim();
                return (
                  <View key={expense.id} style={styles.expenseRow}>
                    <View style={styles.expenseName}><TextInput style={styles.input} placeholder="Имя" placeholderTextColor={COLORS.textDim} value={expense.name} onChangeText={(v) => updateExpense(expense.id, 'name', v)} /></View>
                    <View style={styles.expenseDesc}><TextInput style={styles.input} placeholder="2к, 1 френч..." placeholderTextColor={COLORS.textDim} value={expense.description} onChangeText={(v) => updateExpense(expense.id, 'description', v)} /></View>
                    {(!isLast || !hasContent) ? <TouchableOpacity style={styles.removeBtn} onPress={() => removeExpense(expense.id)}><Text style={styles.removeBtnText}>✕</Text></TouchableOpacity> : <View style={styles.removeBtn} />}
                  </View>
                );
              })}
              {settings?.showPhoto !== false && (
                <View style={styles.photoSection}>
                  <TouchableOpacity style={styles.photoBtn} onPress={showPhotoOptions}><Text style={styles.photoBtnText}>{photoUri ? '📸 Заменить чек' : '📷 Прикрепить чек'}</Text></TouchableOpacity>
                  {photoUri && <View style={styles.photoPreview}><Image source={{ uri: photoUri }} style={styles.photoImage} /><TouchableOpacity style={styles.photoRemove} onPress={() => { setPhotoUri(null); setPhotoBase64(null); }}><Text style={styles.photoRemoveText}>✕ Удалить</Text></TouchableOpacity></View>}
                </View>
              )}
            </View>
          )}

          <View style={[styles.resultCard, { backgroundColor: diffBg, borderColor: diffColor }]}>
            <View style={styles.resultRow}><Text style={styles.resultLabel}>{percentLabel} от Факта</Text><Text style={styles.resultValue}>{formatNum(calc.twoPercent)} ₽</Text></View>
            <View style={[styles.divider, { backgroundColor: diffColor }]} />
            <View style={styles.resultRow}><Text style={styles.resultLabel}>{differenceLabel.split(':')[0]}</Text><Text style={[styles.resultValue, { color: diffColor }]}>{differenceLabel.split(': ')[1] || differenceLabel}</Text></View>
          </View>

          <TouchableOpacity style={[styles.shareBtn, sending && { opacity: 0.6 }]} onPress={handleShare} disabled={sending}><Text style={styles.shareBtnText}>{sending ? 'Отправка...' : 'Отправить отчёт'}</Text></TouchableOpacity>
        </>
      )}

      <PickerModal visible={showWorkerPicker} title="Выберите сотрудника" items={workers.map(w => ({ id: w.id, label: w.name }))} onSelect={selectWorker} onClose={() => setShowWorkerPicker(false)} />
      <PickerModal visible={showGoodsPicker} title="Выберите товар" items={goodsList.map(g => ({ id: g.id, label: g.title, sublabel: `${g.cost} ₽` }))} onSelect={selectGoodsItem} onClose={() => { setShowGoodsPicker(false); setCurrentGoodsIndex(null); }} />
      <PickerModal visible={showCashWorkerPicker} title="Кто взял деньги" items={workers.map(w => ({ id: w.id, label: w.name }))} onSelect={selectCashWorker} onClose={() => setShowCashWorkerPicker(false)} />

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 16 },
  card: { backgroundColor: COLORS.card, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  cardTitle: { color: COLORS.text, fontSize: 15, fontWeight: '600', marginBottom: 12 },
  row: { flexDirection: 'row', gap: 12 },
  field: { flex: 1 },
  label: { color: COLORS.textDim, fontSize: 13, marginBottom: 6 },
  input: { backgroundColor: COLORS.inputBg, borderRadius: 8, padding: 12, color: COLORS.text, fontSize: 16, borderWidth: 1, borderColor: COLORS.border },
  totalRow: { color: COLORS.textDim, fontSize: 14, marginTop: 12 },
  totalNum: { color: COLORS.text, fontWeight: '600' },
  smartShellBtn: { marginTop: 12, backgroundColor: '#1a3a2a', borderWidth: 1, borderColor: COLORS.green, borderRadius: 8, padding: 10, alignItems: 'center' },
  smartShellBtnText: { color: COLORS.green, fontSize: 13, fontWeight: '600' },
  loadedBadge: { marginTop: 10, backgroundColor: COLORS.greenBg, borderRadius: 6, paddingVertical: 4, paddingHorizontal: 10, alignSelf: 'flex-start' },
  loadedBadgeText: { color: COLORS.green, fontSize: 11, fontWeight: '700' },
  pickerBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.inputBg, borderRadius: 8, padding: 12, borderWidth: 1, borderColor: COLORS.border },
  pickerBtnText: { color: COLORS.text, fontSize: 16, flex: 1 },
  pickerArrow: { color: COLORS.textDim, fontSize: 12 },
  pickerField: { flex: 2, backgroundColor: COLORS.inputBg, borderRadius: 8, padding: 12, borderWidth: 1, borderColor: COLORS.border },
  pickerText: { color: COLORS.text, fontSize: 16 },
  expenseRow: { flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'center' },
  expenseName: { flex: 2 },
  expenseDesc: { flex: 2 },
  expenseSmall: { flex: 1 },
  removeBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  removeBtnText: { color: COLORS.red, fontSize: 16 },
  addBtn: { marginTop: 8, backgroundColor: COLORS.inputBg, borderWidth: 1, borderColor: COLORS.border, borderStyle: 'dashed', borderRadius: 8, padding: 12, alignItems: 'center' },
  addBtnText: { color: COLORS.green, fontSize: 13 },
  photoSection: { marginTop: 16, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 12 },
  photoBtn: { backgroundColor: COLORS.inputBg, borderWidth: 1, borderColor: COLORS.border, borderStyle: 'dashed', borderRadius: 8, padding: 14, alignItems: 'center' },
  photoBtnText: { color: COLORS.green, fontSize: 14 },
  photoPreview: { marginTop: 10 },
  photoImage: { width: '100%', height: 200, borderRadius: 8, resizeMode: 'cover' },
  photoRemove: { marginTop: 8, alignItems: 'center' },
  photoRemoveText: { color: COLORS.red, fontSize: 13 },
  resultCard: { borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1 },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  resultLabel: { color: COLORS.textDim, fontSize: 15 },
  resultValue: { color: COLORS.text, fontSize: 20, fontWeight: '700' },
  divider: { height: 1, marginVertical: 8, opacity: 0.3 },
  shareBtn: { backgroundColor: COLORS.green, borderRadius: 12, padding: 16, alignItems: 'center' },
  shareBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  finesList: { marginTop: 16, backgroundColor: COLORS.redBg, borderRadius: 8, padding: 12, borderWidth: 1, borderColor: COLORS.red },
  finesTitle: { color: COLORS.red, fontSize: 13, fontWeight: '700', marginBottom: 8 },
  fineRow: { paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  fineText: { color: COLORS.textDim, fontSize: 12 },
  fineTotal: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.red },
  fineTotalText: { color: COLORS.red, fontSize: 14, fontWeight: '700', textAlign: 'right' },
});