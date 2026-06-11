import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  Alert, Image, ActionSheetIOS, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Sharing from 'expo-sharing';
import { supabase } from '../utils/supabase';
import { ShiftForm, SavedReport, FineRecord } from '../types';
import { calculateShift } from '../utils/calculations';
import { saveDraft, getDraft, clearDraft, getWorkersFromSupabase, saveFine, getUnpaidFines } from '../utils/storage';
import {
  getShiftData, isShellLoggedIn, getCurrentWorker, getGoodsWithPrices, getUserRole,
} from '../utils/smartshell';
import { useAuth } from '../utils/AuthContext';
import { useIsFocused } from '@react-navigation/native';
import PickerModal from '../components/PickerModal';
import { getSettings, ShiftSettings } from '../utils/settings';

const COLORS = {
  bg: '#1a1d23', card: '#21242b', border: '#2a2d35', text: '#e0e0e0',
  textDim: '#8b8d94', green: '#4caf93', greenBg: '#1a2a24', red: '#e0556a',
  redBg: '#2a1a1e', inputBg: '#282c34',
};

const formatNum = (n: number) => n.toLocaleString('ru-RU');

const buildReportText = (
  form: ShiftForm, calc: ReturnType<typeof calculateShift>, workerName: string,
  goodsTaken: { workerName: string; goodsName: string; quantity: string; price: string }[],
  cashTaken: { workerName: string; amount: string }[],
  fineAmount: string, fineReason: string, isManager: boolean,
  cleanerAmount: string, transfers: string,
) => {
  const expensesText = form.expenses.filter(e => e.name.trim() || e.description.trim()).map(e => `${e.name}: ${e.description}`).join('\n');
  const goodsText = goodsTaken.filter(g => g.workerName.trim() && g.goodsName.trim()).map(g => `${g.workerName}: ${g.goodsName} ×${g.quantity || '0'} = ${formatNum((parseInt(g.quantity) || 0) * (parseInt(g.price) || 0))} ₽`).join('\n');
  const cashText = cashTaken.filter(c => c.workerName.trim() && c.amount.trim()).map(c => `${c.workerName}: ${formatNum(parseInt(c.amount) || 0)} ₽`).join('\n');
  const diffText = calc.difference > 0 ? `Пересдача: +${formatNum(calc.difference)} ₽` : calc.difference < 0 ? `Недосдача: ${formatNum(calc.difference)} ₽` : `0 ₽ (сходится)`;
  const percentLabel = calc.dashTotal > 10000 ? '3%' : '2%';

  let text = `Сдача смены\nСотрудник: ${workerName || '—'}\n---\nДэш: ${formatNum(calc.dashTotal)}\nНал: ${formatNum(parseFloat(form.dashCash) || 0)}\nКарта: ${formatNum(parseFloat(form.dashCashless) || 0)}\n---\nФакт: ${formatNum(calc.factTotal)}\nНал: ${formatNum(parseFloat(form.factCash) || 0)}\nКарта: ${formatNum(parseFloat(form.factCashless) || 0)}\nПереводы: ${transfers ? formatNum(parseInt(transfers)) : '0'} ₽\nУборщица: ${cleanerAmount ? formatNum(parseInt(cleanerAmount)) : '0'} ₽\n---\nВзято товарами:\n${goodsText || '—'}\nВзято деньгами:\n${cashText || '—'}\n---\nРасходы (старые):\n${expensesText || '—'}`;
  if (isManager) text += `\n---\nШтраф: ${fineAmount ? formatNum(parseInt(fineAmount)) + ' ₽ — ' + (fineReason || 'Не указана') : 'Нет'}`;
  text += `\n---\n${percentLabel}: ${formatNum(calc.twoPercent)}\n---\n${diffText}`;
  return text;
};

export default function ShiftScreen() {
  const { isLoggedIn } = useAuth();
  const isFocused = useIsFocused();

  const [form, setForm] = useState<ShiftForm>({ dashCash: '', dashCashless: '', factCash: '', factCashless: '', transfers: '', expenses: [{ id: '1', name: '', description: '' }] });
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [smartShellLoaded, setSmartShellLoaded] = useState(false);
  const [workerName, setWorkerName] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [goodsTaken, setGoodsTaken] = useState<{ workerName: string; goodsName: string; quantity: string; price: string }[]>([{ workerName: '', goodsName: '', quantity: '', price: '' }]);
  const [cashTaken, setCashTaken] = useState<{ workerName: string; amount: string }[]>([{ workerName: '', amount: '' }]);
  const [cleanerAmount, setCleanerAmount] = useState('');
  const [fineAmount, setFineAmount] = useState('');
  const [fineReason, setFineReason] = useState('');
  const [settings, setSettings] = useState<ShiftSettings | null>(null);
  const [isActiveOperator, setIsActiveOperator] = useState(false);
  const [unpaidFines, setUnpaidFines] = useState<FineRecord[]>([]);
  const [workers, setWorkers] = useState<{ id: string; name: string }[]>([]);
  const [goodsList, setGoodsList] = useState<{ id: string; title: string; cost: number }[]>([]);
  const [showWorkerPicker, setShowWorkerPicker] = useState(false);
  const [showGoodsPicker, setShowGoodsPicker] = useState(false);
  const [currentGoodsIndex, setCurrentGoodsIndex] = useState<number | null>(null);
  const [currentPickerTarget, setCurrentPickerTarget] = useState<'worker' | 'goodsWorker' | 'cashWorker' | null>(null);
  const userRoles = useRef<string[]>([]);

  const cashTakenTotal = cashTaken.reduce((sum, c) => sum + (parseInt(c.amount) || 0), 0);
  const calc = calculateShift(form, parseInt(cleanerAmount) || 0, cashTakenTotal);
  const isManager = () => userRoles.current.some(r => r.toLowerCase().includes('manager') || r.toLowerCase().includes('owner') || r.toLowerCase().includes('admin'));
  const showAllBlocks = !isManager() || isActiveOperator;

  useEffect(() => { loadDraft(); loadShiftSettings(); }, []);
  useEffect(() => { if (isFocused) loadShiftSettings(); }, [isFocused]);
  useEffect(() => { const t = setTimeout(() => saveDraft({ form, workerName, goodsTaken, cashTaken, cleanerAmount, fineAmount, fineReason }), 500); return () => clearTimeout(t); }, [form, workerName, goodsTaken, cashTaken, cleanerAmount, fineAmount, fineReason]);
  useEffect(() => { if (isLoggedIn && isShellLoggedIn()) { fetchAllData(); setAutoRefresh(true); } }, [isLoggedIn]);
  useEffect(() => {
    if (!autoRefresh || !isShellLoggedIn()) return;
    const i = setInterval(async () => { try { const d = await getShiftData(); if (d) setForm(p => ({ ...p, dashCash: String(d.cash), dashCashless: String(d.cashless) })); } catch (e) {} }, 15000);
    return () => clearInterval(i);
  }, [autoRefresh]);

  const loadDraft = async () => {
    const d = await getDraft();
    if (d) {
      if (d.form) setForm(d.form);
      if (d.workerName) setWorkerName(d.workerName);
      if (d.goodsTaken) setGoodsTaken(d.goodsTaken);
      if (d.cashTaken) setCashTaken(d.cashTaken);
      if (d.cleanerAmount) setCleanerAmount(d.cleanerAmount);
      if (d.fineAmount) setFineAmount(d.fineAmount);
      if (d.fineReason) setFineReason(d.fineReason);
    }
  };

  const loadShiftSettings = async () => { const s = await getSettings(); setSettings(s); };

  const fetchAllData = async () => {
    try {
      const [data, w, roles, goods] = await Promise.all([getShiftData(), getWorkersFromSupabase(), getUserRole(), getGoodsWithPrices()]);
      if (data) { setForm(p => ({ ...p, dashCash: String(data.cash), dashCashless: String(data.cashless) })); setSmartShellLoaded(true); }
      setWorkers(w.map((x: any) => ({ id: String(x.id), name: [x.first_name, x.last_name].filter(Boolean).join(' ') || x.nickname || String(x.id) })));
      userRoles.current = roles; setIsActiveOperator(roles.some(r => r.toLowerCase().includes('active_operator')));
      const ao = w.find((x: any) => x.role && x.role.toLowerCase().includes('active_operator'));
      if (ao) { const fn = [ao.first_name, ao.last_name].filter(Boolean).join(' '); if (fn) { setWorkerName(fn); } }
      else { const cw = await getCurrentWorker(); if (cw) { setWorkerName(cw); } }
      setGoodsList(goods);
    } catch (e) {}
  };

  const updateExpense = (id: string, field: 'name' | 'description', v: string) => {
    setForm(p => { const ex = p.expenses.map(e => e.id === id ? { ...e, [field]: v } : e); if (ex[ex.length - 1].name.trim() || ex[ex.length - 1].description.trim()) ex.push({ id: String(Date.now()), name: '', description: '' }); return { ...p, expenses: ex }; });
  };
  const removeExpense = (id: string) => setForm(p => { const ex = p.expenses.filter(e => e.id !== id); if (!ex.length) ex.push({ id: String(Date.now()), name: '', description: '' }); return { ...p, expenses: ex }; });

  const addGoodsTaken = () => setGoodsTaken([...goodsTaken, { workerName: '', goodsName: '', quantity: '', price: '' }]);
  const updateGoodsTaken = (i: number, f: string, v: string) => setGoodsTaken(p => p.map((item, idx) => idx === i ? { ...item, [f]: v } : item));
  const removeGoodsTaken = (i: number) => setGoodsTaken(p => p.filter((_, idx) => idx !== i));
  const addCashTaken = () => setCashTaken([...cashTaken, { workerName: '', amount: '' }]);
  const updateCashTaken = (i: number, f: string, v: string) => setCashTaken(p => p.map((item, idx) => idx === i ? { ...item, [f]: v } : item));
  const removeCashTaken = (i: number) => setCashTaken(p => p.filter((_, idx) => idx !== i));

  const selectWorker = (item: { id: string; label: string }) => {
    if (currentPickerTarget === 'worker') setWorkerName(item.label);
    else if (currentPickerTarget === 'goodsWorker' && currentGoodsIndex !== null) updateGoodsTaken(currentGoodsIndex, 'workerName', item.label);
    else if (currentPickerTarget === 'cashWorker') {
      setCashTaken(prev => { const updated = [...prev]; const emptyIndex = updated.findIndex(c => !c.workerName.trim()); if (emptyIndex >= 0) updated[emptyIndex] = { ...updated[emptyIndex], workerName: item.label }; return updated; });
    }
    setShowWorkerPicker(false); setCurrentPickerTarget(null);
    if (item.label) getUnpaidFines(item.label).then(setUnpaidFines);
  };
  const selectGoodsItem = (item: { id: string; label: string; sublabel?: string }) => {
    if (currentGoodsIndex !== null) { const g = goodsList.find(x => x.id === item.id); updateGoodsTaken(currentGoodsIndex, 'goodsName', item.label); if (g) updateGoodsTaken(currentGoodsIndex, 'price', String(g.cost)); setCurrentGoodsIndex(null); }
    setShowGoodsPicker(false);
  };
  const openGoodsPicker = (i: number) => { setCurrentGoodsIndex(i); setShowGoodsPicker(true); };

  const handleIssueFine = async () => {
    const a = parseInt(fineAmount) || 0; if (a <= 0) { Alert.alert('Ошибка', 'Введите сумму'); return; } if (!workerName.trim()) { Alert.alert('Ошибка', 'Выберите сотрудника'); return; }
    await saveFine({ id: String(Date.now()), workerName, amount: a, reason: fineReason || 'Не указана', date: new Date().toISOString(), paid: false });
    getUnpaidFines(workerName).then(setUnpaidFines); setFineAmount(''); setFineReason(''); Alert.alert('Готово', `Штраф ${a} ₽ выписан ${workerName}`);
  };

  const pickFromCamera = async () => {
    const p = await ImagePicker.requestCameraPermissionsAsync(); if (!p.granted) { Alert.alert('Нет доступа'); return; }
    const r = await ImagePicker.launchCameraAsync({ quality: 0.3, base64: true });
    if (!r.canceled && r.assets[0]) { const m = await ImageManipulator.manipulateAsync(r.assets[0].uri, [{ resize: { width: 400 } }], { compress: 0.3, format: ImageManipulator.SaveFormat.JPEG, base64: true }); setPhotoUri(m.uri); setPhotoBase64(m.base64 || null); }
  };
  const pickFromGallery = async () => {
    const p = await ImagePicker.requestMediaLibraryPermissionsAsync(); if (!p.granted) { Alert.alert('Нет доступа'); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.3, base64: true });
    if (!r.canceled && r.assets[0]) { const m = await ImageManipulator.manipulateAsync(r.assets[0].uri, [{ resize: { width: 400 } }], { compress: 0.3, format: ImageManipulator.SaveFormat.JPEG, base64: true }); setPhotoUri(m.uri); setPhotoBase64(m.base64 || null); }
  };
  const showPhotoOptions = () => {
    if (Platform.OS === 'ios') ActionSheetIOS.showActionSheetWithOptions({ options: ['Камера', 'Галерея', 'Отмена'], cancelButtonIndex: 2 }, i => { if (i === 0) pickFromCamera(); if (i === 1) pickFromGallery(); });
    else Alert.alert('Фото', 'Выберите', [{ text: 'Камера', onPress: pickFromCamera }, { text: 'Галерея', onPress: pickFromGallery }, { text: 'Отмена', style: 'cancel' }]);
  };

  const handleShare = async () => {
    if (!form.factCash && !form.factCashless) { Alert.alert('Ошибка', 'Заполните Факт'); return; }
    setSending(true); setAutoRefresh(false);
    const text = buildReportText(form, calc, workerName, goodsTaken, cashTaken, fineAmount, fineReason, isManager(), cleanerAmount, form.transfers || '');
    const fe = form.expenses.filter(e => e.name.trim() || e.description.trim());
    const rid = Date.now() * 1000 + Math.floor(Math.random() * 1000);
    const report: SavedReport = {
      id: String(rid), date: new Date().toISOString(), workerName,
      dashTotal: calc.dashTotal, dashCash: parseFloat(form.dashCash) || 0, dashCashless: parseFloat(form.dashCashless) || 0,
      factTotal: calc.factTotal, factCash: parseFloat(form.factCash) || 0, factCashless: parseFloat(form.factCashless) || 0,
      expenses: fe.map(e => ({ name: e.name, description: e.description })), twoPercent: calc.twoPercent, difference: calc.difference,
      photoBase64: photoBase64 || undefined,
      goodsTaken: goodsTaken.filter(g => g.workerName.trim() && g.goodsName.trim()).map(g => ({ workerName: g.workerName, name: g.goodsName, quantity: parseInt(g.quantity) || 0, price: parseInt(g.price) || 0 })),
      cashTakenItems: cashTaken.filter(c => c.workerName.trim() && c.amount.trim()).map(c => ({ workerName: c.workerName, amount: parseInt(c.amount) || 0 })),
      cleanerAmount: parseInt(cleanerAmount) || 0,
      transfers: parseInt(form.transfers) || 0,
      fine: isManager() && parseInt(fineAmount) > 0 ? { amount: parseInt(fineAmount), reason: fineReason || 'Не указана' } : undefined,
    };
    await saveDraft({}); await clearDraft();
    setTimeout(() => { supabase.insert('reports', { id: rid, date: report.date, worker_name: report.workerName || '', dash_total: report.dashTotal, dash_cash: report.dashCash, dash_cashless: report.dashCashless, fact_total: report.factTotal, fact_cash: report.factCash, fact_cashless: report.factCashless, two_percent: report.twoPercent, difference: report.difference, expenses: report.expenses || [], goods_taken: report.goodsTaken || [], cash_taken_items: report.cashTakenItems || [], cleaner_amount: report.cleanerAmount || 0, transfers: report.transfers || 0, fine: report.fine || null }); }, 100);
    setTimeout(async () => {
      try { if (photoUri) await Sharing.shareAsync(photoUri, { mimeType: 'image/jpeg', dialogTitle: text }); else { const { Share } = require('react-native'); await Share.share({ message: text }); } } catch (e: any) {}
    }, 300);
    setForm({ dashCash: '', dashCashless: '', factCash: '', factCashless: '', transfers: '', expenses: [{ id: String(Date.now()), name: '', description: '' }] });
    setPhotoUri(null); setPhotoBase64(null); setGoodsTaken([{ workerName: '', goodsName: '', quantity: '', price: '' }]); setCashTaken([{ workerName: '', amount: '' }]);
    setCleanerAmount(''); setFineAmount(''); setFineReason(''); setSending(false);
    setTimeout(() => { setAutoRefresh(true); fetchAllData(); }, 2000);
  };

  const diffLabel = calc.difference > 0 ? `Пересдача: +${formatNum(calc.difference)} ₽` : calc.difference < 0 ? `Недосдача: ${formatNum(calc.difference)} ₽` : `0 ₽ (сходится)`;
  const diffColor = calc.difference >= 0 ? COLORS.green : COLORS.red;
  const diffBg = calc.difference >= 0 ? COLORS.greenBg : COLORS.redBg;
  const pctLabel = calc.dashTotal > 10000 ? '3%' : '2%';

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      {settings?.showWorker !== false && (
        <View style={styles.card}><Text style={styles.cardTitle}>Сотрудник</Text><TouchableOpacity style={styles.pickerBtn} onPress={() => { setCurrentPickerTarget('worker'); setShowWorkerPicker(true); }}><Text style={[styles.pickerBtnText, !workerName && { color: COLORS.textDim }]}>{workerName || 'Выберите'}</Text><Text style={styles.pickerArrow}>▼</Text></TouchableOpacity></View>
      )}
      {settings?.showDash !== false && (
        <View style={styles.card}><Text style={styles.cardTitle}>Дэш</Text><View style={styles.row}><View style={styles.field}><Text style={styles.label}>Нал</Text><TextInput style={styles.input} keyboardType="numeric" placeholder="0" placeholderTextColor={COLORS.textDim} value={form.dashCash} onChangeText={v => setForm({ ...form, dashCash: v })} /></View><View style={styles.field}><Text style={styles.label}>Карта</Text><TextInput style={styles.input} keyboardType="numeric" placeholder="0" placeholderTextColor={COLORS.textDim} value={form.dashCashless} onChangeText={v => setForm({ ...form, dashCashless: v })} /></View></View><Text style={styles.totalRow}>Итого: <Text style={styles.totalNum}>{formatNum(calc.dashTotal)} ₽</Text></Text>{!smartShellLoaded && isLoggedIn && <TouchableOpacity style={styles.smartShellBtn} onPress={fetchAllData}><Text style={styles.smartShellBtnText}>📡 Загрузить из SmartShell</Text></TouchableOpacity>}{smartShellLoaded && <View style={styles.loadedBadge}><Text style={styles.loadedBadgeText}>✓ SmartShell</Text></View>}</View>
      )}
      {isManager() && !isActiveOperator && (
        <View style={styles.card}><Text style={styles.cardTitle}>Выписать штраф</Text><View style={styles.row}><View style={styles.field}><Text style={styles.label}>Сумма</Text><TextInput style={styles.input} keyboardType="numeric" placeholder="0" placeholderTextColor={COLORS.textDim} value={fineAmount} onChangeText={setFineAmount} /></View><View style={styles.field}><Text style={styles.label}>Причина</Text><TextInput style={styles.input} placeholder="За что" placeholderTextColor={COLORS.textDim} value={fineReason} onChangeText={setFineReason} /></View></View><TouchableOpacity style={[styles.shareBtn, { marginTop: 12 }]} onPress={handleIssueFine}><Text style={styles.shareBtnText}>Выписать штраф</Text></TouchableOpacity>{unpaidFines.length > 0 && (<View style={styles.finesList}><Text style={styles.finesTitle}>Неоплаченные штрафы:</Text>{unpaidFines.map(f => (<View key={f.id} style={styles.fineRow}><Text style={styles.fineText}>{new Date(f.date).toLocaleDateString('ru-RU')} | {formatNum(f.amount)} ₽ | {f.reason}</Text></View>))}<View style={styles.fineTotal}><Text style={styles.fineTotalText}>Итого: {formatNum(unpaidFines.reduce((s, f) => s + f.amount, 0))} ₽</Text></View></View>)}</View>
      )}
      {showAllBlocks && (
        <>
          {settings?.showFact !== false && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Факт</Text>
              <View style={styles.row}>
                <View style={styles.field}><Text style={styles.label}>Нал</Text><TextInput style={styles.input} keyboardType="numeric" placeholder="0" placeholderTextColor={COLORS.textDim} value={form.factCash} onChangeText={v => setForm({ ...form, factCash: v })} /></View>
                <View style={styles.field}><Text style={styles.label}>Карта</Text><TextInput style={styles.input} keyboardType="numeric" placeholder="0" placeholderTextColor={COLORS.textDim} value={form.factCashless} onChangeText={v => setForm({ ...form, factCashless: v })} /></View>
              </View>
              <View style={[styles.row, { marginTop: 12 }]}>
                <View style={styles.field}><Text style={styles.label}>Переводы</Text><TextInput style={styles.input} keyboardType="numeric" placeholder="0" placeholderTextColor={COLORS.textDim} value={form.transfers || ''} onChangeText={v => setForm({ ...form, transfers: v })} /></View>
              </View>
              <Text style={styles.totalRow}>Итого: <Text style={styles.totalNum}>{formatNum(calc.factTotal)} ₽</Text></Text>
            </View>
          )}

          {settings?.showCleaner !== false && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Уборщица</Text>
              <TextInput style={styles.input} keyboardType="numeric" placeholder="Сумма" placeholderTextColor={COLORS.textDim} value={cleanerAmount} onChangeText={setCleanerAmount} />
            </View>
          )}

          {settings?.showGoodsTaken !== false && (
            <View style={styles.card}><Text style={styles.cardTitle}>Взято товарами под зарплату</Text>
              {goodsTaken.map((item, index) => (
                <View key={index} style={styles.goodsRow}>
                  <TouchableOpacity style={styles.pickerField} onPress={() => { setCurrentPickerTarget('goodsWorker'); setCurrentGoodsIndex(index); setShowWorkerPicker(true); }}><Text style={[styles.pickerText, !item.workerName && { color: COLORS.textDim }]}>{item.workerName || 'Кто'}</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.pickerField} onPress={() => openGoodsPicker(index)}><Text style={[styles.pickerText, !item.goodsName && { color: COLORS.textDim }]}>{item.goodsName || 'Товар'}</Text></TouchableOpacity>
                  <View style={styles.expenseSmall}><TextInput style={styles.input} placeholder="Кол" keyboardType="numeric" value={item.quantity} onChangeText={v => updateGoodsTaken(index, 'quantity', v)} /></View>
                  <View style={styles.expenseSmall}><Text style={styles.priceText}>{formatNum((parseInt(item.quantity) || 0) * (parseInt(item.price) || 0))} ₽</Text></View>
                  <TouchableOpacity style={styles.removeBtn} onPress={() => removeGoodsTaken(index)}><Text style={styles.removeBtnText}>✕</Text></TouchableOpacity>
                </View>
              ))}<TouchableOpacity style={styles.addBtn} onPress={addGoodsTaken}><Text style={styles.addBtnText}>+ Добавить</Text></TouchableOpacity></View>
          )}
          {settings?.showCashTaken !== false && (
            <View style={styles.card}><Text style={styles.cardTitle}>Взято деньгами из кассы</Text>
              {cashTaken.map((item, index) => (
                <View key={index} style={styles.expenseRow}>
                  <TouchableOpacity style={styles.pickerField} onPress={() => { setCurrentPickerTarget('cashWorker'); setShowWorkerPicker(true); }}><Text style={[styles.pickerText, !item.workerName && { color: COLORS.textDim }]}>{item.workerName || 'Кто'}</Text></TouchableOpacity>
                  <View style={styles.expenseSmall}><TextInput style={styles.input} placeholder="Сумма" keyboardType="numeric" value={item.amount} onChangeText={v => updateCashTaken(index, 'amount', v)} /></View>
                  <TouchableOpacity style={styles.removeBtn} onPress={() => removeCashTaken(index)}><Text style={styles.removeBtnText}>✕</Text></TouchableOpacity>
                </View>
              ))}<TouchableOpacity style={styles.addBtn} onPress={addCashTaken}><Text style={styles.addBtnText}>+ Добавить</Text></TouchableOpacity></View>
          )}
          {settings?.showFine !== false && isManager() && isActiveOperator && (<View style={styles.card}><Text style={styles.cardTitle}>Штраф</Text><View style={styles.row}><View style={styles.field}><Text style={styles.label}>Сумма</Text><TextInput style={styles.input} keyboardType="numeric" placeholder="0" placeholderTextColor={COLORS.textDim} value={fineAmount} onChangeText={setFineAmount} /></View><View style={styles.field}><Text style={styles.label}>Причина</Text><TextInput style={styles.input} placeholder="За что" placeholderTextColor={COLORS.textDim} value={fineReason} onChangeText={setFineReason} /></View></View></View>)}
          {settings?.showOtherExpenses !== false && (
            <View style={styles.card}><Text style={styles.cardTitle}>Прочие расходы</Text>
              {form.expenses.map((exp, i) => { const last = i === form.expenses.length - 1; const has = exp.name.trim() || exp.description.trim(); return (<View key={exp.id} style={styles.expenseRow}><View style={styles.expenseName}><TextInput style={styles.input} placeholder="Имя" placeholderTextColor={COLORS.textDim} value={exp.name} onChangeText={v => updateExpense(exp.id, 'name', v)} /></View><View style={styles.expenseDesc}><TextInput style={styles.input} placeholder="2к, 1 френч..." placeholderTextColor={COLORS.textDim} value={exp.description} onChangeText={v => updateExpense(exp.id, 'description', v)} /></View>{(!last || !has) ? <TouchableOpacity style={styles.removeBtn} onPress={() => removeExpense(exp.id)}><Text style={styles.removeBtnText}>✕</Text></TouchableOpacity> : <View style={styles.removeBtn} />}</View>); })}
              {settings?.showPhoto !== false && (<View style={styles.photoSection}><TouchableOpacity style={styles.photoBtn} onPress={showPhotoOptions}><Text style={styles.photoBtnText}>{photoUri ? '📸 Заменить' : '📷 Чек'}</Text></TouchableOpacity>{photoUri && <View style={styles.photoPreview}><Image source={{ uri: photoUri }} style={styles.photoImage} /><TouchableOpacity style={styles.photoRemove} onPress={() => { setPhotoUri(null); setPhotoBase64(null); }}><Text style={styles.photoRemoveText}>✕ Удалить</Text></TouchableOpacity></View>}</View>)}
            </View>
          )}
          <View style={[styles.resultCard, { backgroundColor: diffBg, borderColor: diffColor }]}><View style={styles.resultRow}><Text style={styles.resultLabel}>{pctLabel} от Факта</Text><Text style={styles.resultValue}>{formatNum(calc.twoPercent)} ₽</Text></View><View style={[styles.divider, { backgroundColor: diffColor }]} /><View style={styles.resultRow}><Text style={styles.resultLabel}>{diffLabel.split(':')[0]}</Text><Text style={[styles.resultValue, { color: diffColor }]}>{diffLabel.split(': ')[1] || diffLabel}</Text></View></View>
          <TouchableOpacity style={[styles.shareBtn, sending && { opacity: 0.6 }]} onPress={handleShare} disabled={sending}><Text style={styles.shareBtnText}>{sending ? 'Отправка...' : 'Отправить отчёт'}</Text></TouchableOpacity>
        </>
      )}
      <PickerModal visible={showWorkerPicker} title="Выберите сотрудника" items={workers.map(w => ({ id: w.id, label: w.name }))} onSelect={selectWorker} onClose={() => { setShowWorkerPicker(false); setCurrentPickerTarget(null); }} />
      <PickerModal visible={showGoodsPicker} title="Выберите товар" items={goodsList.map(g => ({ id: g.id, label: g.title, sublabel: `${g.cost} ₽` }))} onSelect={selectGoodsItem} onClose={() => { setShowGoodsPicker(false); setCurrentGoodsIndex(null); }} />
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
  pickerText: { color: COLORS.text, fontSize: 14 },
  goodsRow: { flexDirection: 'row', gap: 6, marginBottom: 8, alignItems: 'center' },
  expenseRow: { flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'center' },
  expenseName: { flex: 2 }, expenseDesc: { flex: 2 }, expenseSmall: { flex: 1 },
  priceText: { color: COLORS.textDim, fontSize: 14, paddingVertical: 12, textAlign: 'right' },
  removeBtn: { width: 28, height: 28, justifyContent: 'center', alignItems: 'center' },
  removeBtnText: { color: COLORS.red, fontSize: 16 },
  addBtn: { marginTop: 8, backgroundColor: COLORS.inputBg, borderWidth: 1, borderColor: COLORS.border, borderStyle: 'dashed', borderRadius: 8, padding: 12, alignItems: 'center' },
  addBtnText: { color: COLORS.green, fontSize: 13 },
  photoSection: { marginTop: 16, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 12 },
  photoBtn: { backgroundColor: COLORS.inputBg, borderWidth: 1, borderColor: COLORS.border, borderStyle: 'dashed', borderRadius: 8, padding: 14, alignItems: 'center' },
  photoBtnText: { color: COLORS.green, fontSize: 14 },
  photoPreview: { marginTop: 10 }, photoImage: { width: '100%', height: 200, borderRadius: 8, resizeMode: 'cover' },
  photoRemove: { marginTop: 8, alignItems: 'center' }, photoRemoveText: { color: COLORS.red, fontSize: 13 },
  resultCard: { borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1 },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  resultLabel: { color: COLORS.textDim, fontSize: 15 }, resultValue: { color: COLORS.text, fontSize: 20, fontWeight: '700' },
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