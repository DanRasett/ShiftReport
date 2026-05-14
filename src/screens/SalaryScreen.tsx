import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, TextInput, Modal,
} from 'react-native';
import { SavedReport } from '../types';
import { getHistory } from '../utils/storage';
import { getUserRole, loginToSmartShell } from '../utils/smartshell';
import { getCredentials } from '../utils/storage';

const COLORS = {
  bg: '#1a1d23', card: '#21242b', border: '#2a2d35', text: '#e0e0e0', textDim: '#8b8d94',
  green: '#4caf93', greenBg: '#1a2a24', red: '#e0556a', redBg: '#2a1a1e', inputBg: '#282c34',
};

const formatNum = (n: number) => n.toLocaleString('ru-RU');

interface WorkerData {
  base: number;
  percent: number;
  goodsExpenses: number;
  cashExpenses: number;
  totalDiff: number;
  fines: { amount: number; reason: string; date: string }[];
  total: number;
  shifts: SavedReport[];
}

export default function SalaryScreen() {
  const [roles, setRoles] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [salaryData, setSalaryData] = useState<Record<string, WorkerData>>({});
  const [loading, setLoading] = useState(false);
  const [fineModal, setFineModal] = useState<{ worker: string } | null>(null);
  const [fineAmount, setFineAmount] = useState('');

  useEffect(() => { checkRole(); }, []);

  const checkRole = async () => {
    const creds = await getCredentials();
    if (creds) { await loginToSmartShell(creds); setRoles(await getUserRole()); }
  };

  const isManagerOrOwner = () => roles.some((r) => r.toLowerCase().includes('manager') || r.toLowerCase().includes('owner') || r.toLowerCase().includes('admin'));

  const calculate = async () => {
    if (!fromDate || !toDate) { Alert.alert('Ошибка', 'Введите даты'); return; }
    setLoading(true);
    try {
      const fromParts = fromDate.split('.'); const toParts = toDate.split('.');
      const from = `${fromParts[2]}-${fromParts[1]}-${fromParts[0]}`;
      const to = `${toParts[2]}-${toParts[1]}-${toParts[0]}`;
      const allReports = await getHistory();
      const filtered = allReports.filter((r) => r.date.substring(0, 10) >= from && r.date.substring(0, 10) <= to);
      const byWorker: Record<string, SavedReport[]> = {};
      filtered.forEach((r) => { const w = r.workerName || 'Неизвестный'; if (!byWorker[w]) byWorker[w] = []; byWorker[w].push(r); });
      const result: Record<string, WorkerData> = {};
      Object.entries(byWorker).forEach(([worker, shifts]) => {
        let base = 0, percent = 0, goodsExpenses = 0, cashExpenses = 0, totalDiff = 0;
        const fines: { amount: number; reason: string; date: string }[] = [];
        shifts.forEach((s) => {
          base += 1400;
          percent += s.twoPercent || 0;
          totalDiff += s.difference || 0;
          if (s.goodsTaken) s.goodsTaken.forEach((g) => { goodsExpenses += (g.quantity || 0) * (g.price || 0); });
          cashExpenses += s.cashTaken || 0;
          if (s.fine) fines.push({ amount: s.fine.amount, reason: s.fine.reason, date: s.date.substring(0, 10) });
        });
        const totalFines = fines.reduce((s, f) => s + f.amount, 0);
        result[worker] = { base, percent, goodsExpenses, cashExpenses, totalDiff, fines, total: base + percent + totalDiff - goodsExpenses - cashExpenses - totalFines, shifts };
      });
      setSalaryData(result);
    } catch (e) { Alert.alert('Ошибка', 'Не удалось рассчитать'); }
    setLoading(false);
  };

  if (!isManagerOrOwner()) return <View style={styles.container}><View style={styles.lockedCard}><Text style={styles.lockedIcon}>🔒</Text><Text style={styles.lockedTitle}>Доступ ограничен</Text><Text style={styles.lockedText}>Этот раздел доступен только для менеджеров и владельцев</Text></View></View>;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Расчёт зарплаты</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Период</Text>
        <View style={styles.dateRow}>
          <View style={styles.dateField}><Text style={styles.label}>С (ДД.ММ.ГГГГ)</Text><TextInput style={styles.input} placeholder="01.05.2025" placeholderTextColor={COLORS.textDim} value={fromDate} onChangeText={setFromDate} /></View>
          <View style={styles.dateField}><Text style={styles.label}>По (ДД.ММ.ГГГГ)</Text><TextInput style={styles.input} placeholder="10.05.2025" placeholderTextColor={COLORS.textDim} value={toDate} onChangeText={setToDate} /></View>
        </View>
        <TouchableOpacity style={styles.calcBtn} onPress={calculate} disabled={loading}><Text style={styles.calcBtnText}>{loading ? 'Расчёт...' : 'Рассчитать'}</Text></TouchableOpacity>
      </View>
      {Object.keys(salaryData).length > 0 && (
        <>
          {Object.entries(salaryData).map(([worker, data]) => (
            <View key={worker} style={styles.workerCard}>
              <Text style={styles.workerName}>{worker}</Text>
              <Text style={styles.shiftCount}>Смен: {data.shifts.length}</Text>
              <View style={styles.shiftsBlock}>
                <Text style={styles.shiftsTitle}>Смены:</Text>
                {data.shifts.map((s, i) => {
                  const percentLabel = s.dashTotal > 10000 ? '3%' : '2%';
                  return (
                    <View key={i} style={styles.shiftDetailRow}>
                      <Text style={styles.shiftDetail}>
                        {new Date(s.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })} | Дэш: {formatNum(s.dashTotal)} ₽ | Факт: {formatNum(s.factTotal)} ₽ | {percentLabel}: {formatNum(s.twoPercent)} ₽ | {s.difference > 0 ? '+' : ''}{formatNum(s.difference)} ₽
                      </Text>
                      {s.goodsTaken && s.goodsTaken.length > 0 && (
                        <Text style={styles.shiftDetail}>Товары: {s.goodsTaken.map((g) => `${g.name} ×${g.quantity} = ${formatNum(g.quantity * g.price)} ₽`).join(', ')}</Text>
                      )}
                      {s.cashTaken && s.cashTaken > 0 && <Text style={styles.shiftDetail}>Взято деньгами: {formatNum(s.cashTaken)} ₽</Text>}
                      {s.fine && <Text style={[styles.shiftDetail, { color: COLORS.red }]}>Штраф: {formatNum(s.fine.amount)} ₽ — {s.fine.reason}</Text>}
                    </View>
                  );
                })}
              </View>
              <View style={styles.divider} />
              <View style={styles.salaryRow}><Text style={styles.salaryLabel}>Базовая ставка ({data.shifts.length} × 1400):</Text><Text style={styles.salaryValue}>{formatNum(data.base)} ₽</Text></View>
              <View style={styles.salaryRow}><Text style={styles.salaryLabel}>Процент:</Text><Text style={[styles.salaryValue, { color: COLORS.green }]}>+{formatNum(data.percent)} ₽</Text></View>
              {data.totalDiff !== 0 && <View style={styles.salaryRow}><Text style={styles.salaryLabel}>Пересдача/Недосдача:</Text><Text style={[styles.salaryValue, { color: data.totalDiff >= 0 ? COLORS.green : COLORS.red }]}>{data.totalDiff > 0 ? '+' : ''}{formatNum(data.totalDiff)} ₽</Text></View>}
              <View style={styles.salaryRow}><Text style={styles.salaryLabel}>Взято товарами:</Text><Text style={[styles.salaryValue, { color: COLORS.red }]}>-{formatNum(data.goodsExpenses)} ₽</Text></View>
              <View style={styles.salaryRow}><Text style={styles.salaryLabel}>Взято деньгами:</Text><Text style={[styles.salaryValue, { color: COLORS.red }]}>-{formatNum(data.cashExpenses)} ₽</Text></View>
              {data.fines.length > 0 && (
                <View style={styles.salaryRow}>
                  <Text style={styles.salaryLabel}>Штрафы ({data.fines.length}):</Text>
                  <Text style={[styles.salaryValue, { color: COLORS.red }]}>-{formatNum(data.fines.reduce((s, f) => s + f.amount, 0))} ₽</Text>
                </View>
              )}
              <View style={styles.totalDivider} />
              <View style={styles.salaryRow}><Text style={styles.salaryTotalLabel}>Итого:</Text><Text style={[styles.salaryTotalValue, { color: data.total >= 0 ? COLORS.green : COLORS.red }]}>{formatNum(data.total)} ₽</Text></View>
            </View>
          ))}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Общий итог</Text>
            <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Сотрудников:</Text><Text style={styles.summaryValue}>{Object.keys(salaryData).length}</Text></View>
            <View style={styles.summaryRow}><Text style={styles.summaryLabel}>К выплате всего:</Text><Text style={[styles.summaryValue, { color: COLORS.green }]}>{formatNum(Object.values(salaryData).reduce((s, d) => s + d.total, 0))} ₽</Text></View>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 16 },
  title: { color: COLORS.text, fontSize: 22, fontWeight: '700', marginBottom: 16 },
  card: { backgroundColor: COLORS.card, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  cardTitle: { color: COLORS.text, fontSize: 16, fontWeight: '600', marginBottom: 12 },
  dateRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  dateField: { flex: 1 },
  label: { color: COLORS.textDim, fontSize: 13, marginBottom: 6 },
  input: { backgroundColor: COLORS.inputBg, borderRadius: 8, padding: 12, color: COLORS.text, fontSize: 16, borderWidth: 1, borderColor: COLORS.border },
  calcBtn: { backgroundColor: COLORS.green, borderRadius: 10, padding: 14, alignItems: 'center' },
  calcBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  workerCard: { backgroundColor: COLORS.card, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  workerName: { color: COLORS.text, fontSize: 18, fontWeight: '700', marginBottom: 4 },
  shiftCount: { color: COLORS.textDim, fontSize: 13, marginBottom: 8 },
  shiftsBlock: { marginBottom: 8 },
  shiftsTitle: { color: COLORS.textDim, fontSize: 13, marginBottom: 6, fontWeight: '600' },
  shiftDetailRow: { paddingLeft: 8, paddingVertical: 2 },
  shiftDetail: { color: COLORS.textDim, fontSize: 11 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 8 },
  salaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  salaryLabel: { color: COLORS.textDim, fontSize: 14, flex: 1 },
  salaryValue: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
  totalDivider: { height: 2, backgroundColor: COLORS.green, marginVertical: 8 },
  salaryTotalLabel: { color: COLORS.text, fontSize: 16, fontWeight: '700', flex: 1 },
  salaryTotalValue: { fontSize: 22, fontWeight: '700' },
  summaryCard: { backgroundColor: COLORS.greenBg, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: COLORS.green },
  summaryTitle: { color: COLORS.green, fontSize: 17, fontWeight: '700', marginBottom: 10 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  summaryLabel: { color: COLORS.text, fontSize: 14 },
  summaryValue: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  lockedCard: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  lockedIcon: { fontSize: 60, marginBottom: 20 },
  lockedTitle: { color: COLORS.text, fontSize: 22, fontWeight: '700' },
  lockedText: { color: COLORS.textDim, fontSize: 14, textAlign: 'center' },
});