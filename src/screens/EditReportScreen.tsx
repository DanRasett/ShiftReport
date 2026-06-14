import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  Alert, ActivityIndicator,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { getReportById, updateReport, getWorkersFromSupabase } from '../utils/storage';
import { getGoodsWithPrices } from '../utils/smartshell';
import { SavedReport } from '../types';
import PickerModal from '../components/PickerModal';

const COLORS = {
  bg: '#1a1d23', card: '#21242b', border: '#2a2d35', text: '#e0e0e0',
  textDim: '#8b8d94', green: '#4caf93', inputBg: '#282c34', red: '#e0556a',
};

const formatNum = (n: number) => n.toLocaleString('ru-RU');

export default function EditReportScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation();
  const reportId = route.params?.reportId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [report, setReport] = useState<SavedReport | null>(null);
  const [factCash, setFactCash] = useState('');
  const [factCashless, setFactCashless] = useState('');
  const [cleanerAmount, setCleanerAmount] = useState('');
  const [transfers, setTransfers] = useState('');
  const [goodsTaken, setGoodsTaken] = useState<{ workerName: string; goodsName: string; quantity: string; price: string }[]>([]);
  const [cashTaken, setCashTaken] = useState<{ workerName: string; amount: string }[]>([]);
  const [workers, setWorkers] = useState<{ id: string; name: string }[]>([]);
  const [goodsList, setGoodsList] = useState<{ id: string; title: string; cost: number }[]>([]);
  const [showWorkerPicker, setShowWorkerPicker] = useState(false);
  const [showGoodsPicker, setShowGoodsPicker] = useState(false);
  const [currentGoodsIndex, setCurrentGoodsIndex] = useState<number | null>(null);
  const [currentPickerTarget, setCurrentPickerTarget] = useState<'goodsWorker' | 'cashWorker' | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [reportData, workersData, goodsData] = await Promise.all([
      getReportById(reportId),
      getWorkersFromSupabase(),
      getGoodsWithPrices(),
    ]);

    if (reportData) {
      setReport(reportData);
      setFactCash(String(reportData.factCash));
      setFactCashless(String(reportData.factCashless));
      setCleanerAmount(String(reportData.cleanerAmount || ''));
      setTransfers(String(reportData.transfers || ''));
      setGoodsTaken(
        (reportData.goodsTaken || []).map(g => ({
          workerName: g.workerName || '',
          goodsName: g.name || '',
          quantity: String(g.quantity || ''),
          price: String(g.price || ''),
        }))
      );
      setCashTaken(
        (reportData.cashTakenItems || []).map(c => ({
          workerName: c.workerName || '',
          amount: String(c.amount || ''),
        }))
      );
    }

    setWorkers(workersData.map((w: any) => ({
      id: String(w.id),
      name: [w.first_name, w.last_name].filter(Boolean).join(' ') || w.nickname || String(w.id),
    })));
    setGoodsList(goodsData);
    setLoading(false);
  };

  const addGoodsTaken = () => setGoodsTaken([...goodsTaken, { workerName: '', goodsName: '', quantity: '', price: '' }]);
  const updateGoodsTaken = (i: number, f: string, v: string) => setGoodsTaken(p => p.map((item, idx) => idx === i ? { ...item, [f]: v } : item));
  const removeGoodsTaken = (i: number) => setGoodsTaken(p => p.filter((_, idx) => idx !== i));

  const addCashTaken = () => setCashTaken([...cashTaken, { workerName: '', amount: '' }]);
  const updateCashTaken = (i: number, f: string, v: string) => setCashTaken(p => p.map((item, idx) => idx === i ? { ...item, [f]: v } : item));
  const removeCashTaken = (i: number) => setCashTaken(p => p.filter((_, idx) => idx !== i));

  const selectWorker = (item: { id: string; label: string }) => {
    if (currentPickerTarget === 'goodsWorker' && currentGoodsIndex !== null) {
      updateGoodsTaken(currentGoodsIndex, 'workerName', item.label);
    } else if (currentPickerTarget === 'cashWorker') {
      setCashTaken(prev => {
        const updated = [...prev];
        const emptyIndex = updated.findIndex(c => !c.workerName.trim());
        if (emptyIndex >= 0) updated[emptyIndex] = { ...updated[emptyIndex], workerName: item.label };
        return updated;
      });
    }
    setShowWorkerPicker(false);
    setCurrentPickerTarget(null);
  };

  const selectGoodsItem = (item: { id: string; label: string; sublabel?: string }) => {
    if (currentGoodsIndex !== null) {
      const g = goodsList.find(x => x.id === item.id);
      updateGoodsTaken(currentGoodsIndex, 'goodsName', item.label);
      if (g) updateGoodsTaken(currentGoodsIndex, 'price', String(g.cost));
      setCurrentGoodsIndex(null);
    }
    setShowGoodsPicker(false);
  };

  const handleSave = async () => {
    setSaving(true);
    await updateReport(reportId, {
      fact_cash: parseFloat(factCash) || 0,
      fact_cashless: parseFloat(factCashless) || 0,
      cleaner_amount: parseFloat(cleanerAmount) || 0,
      transfers: parseFloat(transfers) || 0,
      goods_taken: goodsTaken
        .filter(g => g.workerName.trim() && g.goodsName.trim())
        .map(g => ({
          workerName: g.workerName,
          name: g.goodsName,
          quantity: parseInt(g.quantity) || 0,
          price: parseInt(g.price) || 0,
        })),
      cash_taken_items: cashTaken
        .filter(c => c.workerName.trim() && c.amount.trim())
        .map(c => ({
          workerName: c.workerName,
          amount: parseInt(c.amount) || 0,
        })),
    });
    setSaving(false);
    Alert.alert('Сохранено', 'Отчёт обновлён');
    navigation.goBack();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.green} />
      </View>
    );
  }

  if (!report) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Отчёт не найден</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Редактирование отчёта</Text>
      <Text style={styles.subtitle}>
        {report.workerName} — {new Date(report.date).toLocaleString('ru-RU')}
      </Text>

      {/* Дэш (только чтение) */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Дэш (терминал) — только чтение</Text>
        <View style={styles.row}>
          <View style={styles.field}><Text style={styles.label}>Нал</Text><Text style={styles.value}>{formatNum(report.dashCash)} ₽</Text></View>
          <View style={styles.field}><Text style={styles.label}>Карта</Text><Text style={styles.value}>{formatNum(report.dashCashless)} ₽</Text></View>
        </View>
      </View>

      {/* Факт */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Факт</Text>
        <View style={styles.row}>
          <View style={styles.field}><Text style={styles.label}>Нал</Text><TextInput style={styles.input} keyboardType="numeric" value={factCash} onChangeText={setFactCash} /></View>
          <View style={styles.field}><Text style={styles.label}>Карта</Text><TextInput style={styles.input} keyboardType="numeric" value={factCashless} onChangeText={setFactCashless} /></View>
        </View>
        <View style={[styles.row, { marginTop: 12 }]}>
          <View style={styles.field}><Text style={styles.label}>Переводы</Text><TextInput style={styles.input} keyboardType="numeric" value={transfers} onChangeText={setTransfers} /></View>
        </View>
      </View>

      {/* Уборщица */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Уборщица</Text>
        <TextInput style={styles.input} keyboardType="numeric" value={cleanerAmount} onChangeText={setCleanerAmount} />
      </View>

      {/* Товары */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Взято товарами под зарплату</Text>
        {goodsTaken.map((item, index) => (
          <View key={index} style={styles.goodsRow}>
            <TouchableOpacity style={styles.pickerField} onPress={() => { setCurrentPickerTarget('goodsWorker'); setCurrentGoodsIndex(index); setShowWorkerPicker(true); }}>
              <Text style={[styles.pickerText, !item.workerName && { color: COLORS.textDim }]}>{item.workerName || 'Кто'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.pickerField} onPress={() => { setCurrentGoodsIndex(index); setShowGoodsPicker(true); }}>
              <Text style={[styles.pickerText, !item.goodsName && { color: COLORS.textDim }]}>{item.goodsName || 'Товар'}</Text>
            </TouchableOpacity>
            <View style={styles.expenseSmall}><TextInput style={styles.input} placeholder="Кол" keyboardType="numeric" value={item.quantity} onChangeText={v => updateGoodsTaken(index, 'quantity', v)} /></View>
            <View style={styles.expenseSmall}><TextInput style={styles.input} placeholder="Цена" keyboardType="numeric" value={item.price} /></View>
            <TouchableOpacity style={styles.removeBtn} onPress={() => removeGoodsTaken(index)}><Text style={styles.removeBtnText}>✕</Text></TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.addBtn} onPress={addGoodsTaken}><Text style={styles.addBtnText}>+ Добавить</Text></TouchableOpacity>
      </View>

      {/* Деньги */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Взято деньгами из кассы</Text>
        {cashTaken.map((item, index) => (
          <View key={index} style={styles.expenseRow}>
            <TouchableOpacity style={styles.pickerField} onPress={() => { setCurrentPickerTarget('cashWorker'); setShowWorkerPicker(true); }}>
              <Text style={[styles.pickerText, !item.workerName && { color: COLORS.textDim }]}>{item.workerName || 'Кто'}</Text>
            </TouchableOpacity>
            <View style={styles.expenseSmall}><TextInput style={styles.input} placeholder="Сумма" keyboardType="numeric" value={item.amount} onChangeText={v => updateCashTaken(index, 'amount', v)} /></View>
            <TouchableOpacity style={styles.removeBtn} onPress={() => removeCashTaken(index)}><Text style={styles.removeBtnText}>✕</Text></TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.addBtn} onPress={addCashTaken}><Text style={styles.addBtnText}>+ Добавить</Text></TouchableOpacity>
      </View>

      <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
        <Text style={styles.saveBtnText}>{saving ? 'Сохранение...' : 'Сохранить изменения'}</Text>
      </TouchableOpacity>

      <PickerModal visible={showWorkerPicker} title="Выберите сотрудника" items={workers.map(w => ({ id: w.id, label: w.name }))} onSelect={selectWorker} onClose={() => { setShowWorkerPicker(false); setCurrentPickerTarget(null); }} />
      <PickerModal visible={showGoodsPicker} title="Выберите товар" items={goodsList.map(g => ({ id: g.id, label: g.title, sublabel: `${g.cost} ₽` }))} onSelect={selectGoodsItem} onClose={() => { setShowGoodsPicker(false); setCurrentGoodsIndex(null); }} />
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 16 },
  center: { flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: COLORS.red, fontSize: 16 },
  title: { color: COLORS.text, fontSize: 22, fontWeight: '700', marginBottom: 4 },
  subtitle: { color: COLORS.textDim, fontSize: 14, marginBottom: 16 },
  card: { backgroundColor: COLORS.card, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  cardTitle: { color: COLORS.text, fontSize: 15, fontWeight: '600', marginBottom: 12 },
  row: { flexDirection: 'row', gap: 12 },
  field: { flex: 1 },
  label: { color: COLORS.textDim, fontSize: 13, marginBottom: 6 },
  value: { color: COLORS.text, fontSize: 16, padding: 12 },
  input: { backgroundColor: COLORS.inputBg, borderRadius: 8, padding: 12, color: COLORS.text, fontSize: 16, borderWidth: 1, borderColor: COLORS.border },
  pickerField: { flex: 2, backgroundColor: COLORS.inputBg, borderRadius: 8, padding: 12, borderWidth: 1, borderColor: COLORS.border },
  pickerText: { color: COLORS.text, fontSize: 14 },
  goodsRow: { flexDirection: 'row', gap: 6, marginBottom: 8, alignItems: 'center' },
  expenseRow: { flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'center' },
  expenseSmall: { flex: 1 },
  removeBtn: { width: 28, height: 28, justifyContent: 'center', alignItems: 'center' },
  removeBtnText: { color: COLORS.red, fontSize: 16 },
  addBtn: { marginTop: 8, backgroundColor: COLORS.inputBg, borderWidth: 1, borderColor: COLORS.border, borderStyle: 'dashed', borderRadius: 8, padding: 12, alignItems: 'center' },
  addBtnText: { color: COLORS.green, fontSize: 13 },
  saveBtn: { backgroundColor: COLORS.green, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});