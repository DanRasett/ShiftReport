import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, TextInput, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SavedReport } from '../types';
import { getUnpaidReports, markSalaryPaid, getAllUnpaidFines, getWorkersWithSettings } from '../utils/storage';
import { getUserRole, loginToSmartShell } from '../utils/smartshell';
import { getCredentials } from '../utils/storage';
import { exportSalaryToExcel } from '../utils/export';

const COLORS = {
  bg: '#1a1d23', card: '#21242b', border: '#2a2d35', text: '#e0e0e0',
  textDim: '#8b8d94', green: '#4caf93', greenBg: '#1a2a24', red: '#e0556a',
  redBg: '#2a1a1e', inputBg: '#282c34',
};

const formatNum = (n: number) => n.toLocaleString('ru-RU');

interface WorkerData {
  base: number; percent: number; goodsExpenses: number; cashExpenses: number;
  totalDiff: number; fines: { amount: number; reason: string; date: string }[];
  total: number; shifts: SavedReport[];
  goodsDetails: { name: string; quantity: number; total: number }[];
}

export default function SalaryScreen() {
  const [roles, setRoles] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [salaryData, setSalaryData] = useState<Record<string, WorkerData>>({});
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [paying, setPaying] = useState(false);

  useFocusEffect(useCallback(() => { checkRole(); }, []));

  const checkRole = async () => {
    setLoading(true);
    const creds = await getCredentials();
    if (creds) { await loginToSmartShell(creds); setRoles(await getUserRole()); }
    setLoading(false);
  };

  const isManagerOrOwner = () => roles.some(r =>
    r.toLowerCase().includes('manager') || r.toLowerCase().includes('owner') || r.toLowerCase().includes('admin')
  );

  const calculate = async () => {
    if (!fromDate || !toDate) { Alert.alert('Ошибка', 'Введите даты'); return; }
    setCalculating(true);
    try {
      const [fd, fm, fy] = fromDate.split('.').map(Number);
      const [td, tm, ty] = toDate.split('.').map(Number);
      const from = `${fy}-${String(fm).padStart(2, '0')}-${String(fd).padStart(2, '0')}`;
      const to = `${ty}-${String(tm).padStart(2, '0')}-${String(td).padStart(2, '0')}`;

      const allReports = await getUnpaidReports();
      const allUnpaidFines = await getAllUnpaidFines();
      const workersSettings = await getWorkersWithSettings();

      const workerSettingsMap: Record<string, { baseSalary: number; calculatePercent: boolean; includeInSalary: boolean }> = {};
      workersSettings.forEach((w: any) => {
        const fullName = [w.first_name, w.last_name].filter(Boolean).join(' ');
        if (fullName) {
          workerSettingsMap[fullName] = {
            baseSalary: Number(w.base_salary) || 1400,
            calculatePercent: w.calculate_percent !== false,
            includeInSalary: w.include_in_salary !== false,
          };
        }
      });

      const filtered = allReports.filter(r => {
        const reportDate = r.date.substring(0, 10);
        return reportDate >= from && reportDate <= to;
      });

      if (filtered.length === 0) {
        Alert.alert('Нет данных', 'За выбранный период нет неоплаченных отчётов');
        setCalculating(false);
        return;
      }

      const byWorker: Record<string, SavedReport[]> = {};
      filtered.forEach(r => {
        const w = r.workerName || 'Неизвестный';
        const settings = workerSettingsMap[w];
        if (settings && !settings.includeInSalary) return;
        if (!byWorker[w]) byWorker[w] = [];
        byWorker[w].push(r);
      });

      const result: Record<string, WorkerData> = {};

      Object.keys(byWorker).forEach(worker => {
        result[worker] = {
          base: 0, percent: 0, goodsExpenses: 0, cashExpenses: 0,
          totalDiff: 0, fines: [], total: 0, shifts: [],
          goodsDetails: [],
        };
      });

      Object.entries(byWorker).forEach(([worker, shifts]) => {
        const settings = workerSettingsMap[worker] || { baseSalary: 1400, calculatePercent: true };

        shifts.forEach(s => {
          result[worker].base += settings.baseSalary;
          if (settings.calculatePercent) {
            result[worker].percent += s.twoPercent || 0;
          }
          result[worker].totalDiff += s.difference || 0;
          result[worker].shifts.push(s);

          if (s.fine) {
            result[worker].fines.push({ amount: s.fine.amount, reason: s.fine.reason, date: s.date.substring(0, 10) });
          }

          if (s.goodsTaken) {
            s.goodsTaken.forEach(g => {
              const takenByWorker = (g.workerName || worker).trim();
              const amount = (g.quantity || 0) * (g.price || 0);

              // Добавляем в детализацию товаров для того, кто взял
              if (!result[takenByWorker]) {
                result[takenByWorker] = {
                  base: 0, percent: 0, goodsExpenses: 0, cashExpenses: 0,
                  totalDiff: 0, fines: [], total: 0, shifts: [],
                  goodsDetails: [],
                };
              }

              // Ищем товар в goodsDetails
              const existingGood = result[takenByWorker].goodsDetails.find(d => d.name === g.name);
              if (existingGood) {
                existingGood.quantity += g.quantity || 0;
                existingGood.total += amount;
              } else {
                result[takenByWorker].goodsDetails.push({
                  name: g.name,
                  quantity: g.quantity || 0,
                  total: amount,
                });
              }

              if (takenByWorker !== worker) {
                result[takenByWorker].goodsExpenses += amount;
              } else {
                result[worker].goodsExpenses += amount;
              }
            });
          }

          if (s.cashTakenItems) {
            s.cashTakenItems.forEach(item => {
              const takenByWorker = (item.workerName || worker).trim();
              const amount = item.amount || 0;
              if (takenByWorker && takenByWorker !== worker) {
                if (!result[takenByWorker]) {
                  result[takenByWorker] = {
                    base: 0, percent: 0, goodsExpenses: 0, cashExpenses: 0,
                    totalDiff: 0, fines: [], total: 0, shifts: [],
                    goodsDetails: [],
                  };
                }
                result[takenByWorker].cashExpenses += amount;
              } else {
                result[worker].cashExpenses += amount;
              }
            });
          }
        });
      });

      Object.keys(result).forEach(worker => {
        const workerFinesFromTable = allUnpaidFines.filter(f =>
          f.workerName === worker && f.date.substring(0, 10) >= from && f.date.substring(0, 10) <= to
        );
        workerFinesFromTable.forEach(f => {
          result[worker].fines.push({ amount: f.amount, reason: f.reason, date: f.date.substring(0, 10) });
        });
        const d = result[worker];
        const totalFines = d.fines.reduce((s, f) => s + f.amount, 0);
        d.total = d.base + d.percent + d.totalDiff - d.goodsExpenses - d.cashExpenses - totalFines;
      });
      // Удаляем сотрудников с 0 смен
      const filteredResult: Record<string, WorkerData> = {};
      Object.entries(result).forEach(([worker, data]) => {
        if (data.shifts.length > 0) {
          filteredResult[worker] = data;
        }
      });
      setSalaryData(filteredResult);
    } catch (e: any) {
      Alert.alert('Ошибка', 'Не удалось рассчитать: ' + e.message);
    }
    setCalculating(false);
  };

  const handlePaySalary = async () => {
    if (Object.keys(salaryData).length === 0) { Alert.alert('Нет данных', 'Сначала рассчитайте зарплату'); return; }
    const [fd, fm, fy] = fromDate.split('.').map(Number);
    const [td, tm, ty] = toDate.split('.').map(Number);
    const from = `${fy}-${String(fm).padStart(2, '0')}-${String(fd).padStart(2, '0')}`;
    const to = `${ty}-${String(tm).padStart(2, '0')}-${String(td).padStart(2, '0')}`;
    setPaying(true);
    let ok = 0, err = 0;
    for (const [workerName, data] of Object.entries(salaryData)) {
      const reportIds = data.shifts.map(s => s.id);
      try { await markSalaryPaid(reportIds, workerName, from, to); ok++; }
      catch (e: any) { err++; }
    }
    setPaying(false); setSalaryData({});
    Alert.alert('Готово', `Выплачено: ${ok}, Ошибок: ${err}`);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.green} /><Text style={styles.loadingText}>Проверка доступа...</Text></View>;
  if (!isManagerOrOwner()) return <View style={styles.container}><View style={styles.lockedCard}><Text style={styles.lockedIcon}>🔒</Text><Text style={styles.lockedTitle}>Доступ ограничен</Text></View></View>;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Расчёт зарплаты</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Период</Text>
        <View style={styles.dateRow}>
          <View style={styles.dateField}><Text style={styles.label}>С (ДД.ММ.ГГГГ)</Text><TextInput style={styles.input} placeholder="01.05.2025" placeholderTextColor={COLORS.textDim} value={fromDate} onChangeText={setFromDate} keyboardType="numeric" /></View>
          <View style={styles.dateField}><Text style={styles.label}>По (ДД.ММ.ГГГГ)</Text><TextInput style={styles.input} placeholder="10.05.2025" placeholderTextColor={COLORS.textDim} value={toDate} onChangeText={setToDate} keyboardType="numeric" /></View>
        </View>
        <TouchableOpacity style={[styles.calcBtn, calculating && { opacity: 0.6 }]} onPress={calculate} disabled={calculating}><Text style={styles.calcBtnText}>{calculating ? 'Расчёт...' : 'Рассчитать'}</Text></TouchableOpacity>
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
                        <Text style={styles.shiftDetail}>
                          Товары: {s.goodsTaken.map(g => `${g.workerName ? g.workerName + ': ' : ''}${g.name} ×${g.quantity} = ${formatNum(g.quantity * g.price)} ₽`).join(', ')}
                        </Text>
                      )}
                      {s.cashTakenItems && s.cashTakenItems.length > 0 && (
                        <Text style={styles.shiftDetail}>
                          Деньги: {s.cashTakenItems.map(c => `${c.workerName ? c.workerName + ': ' : ''}${formatNum(c.amount)} ₽`).join(', ')}
                        </Text>
                      )}
                      {s.fine && (
                        <Text style={[styles.shiftDetail, { color: COLORS.red }]}>
                          Штраф: {formatNum(s.fine.amount)} ₽ — {s.fine.reason}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>

              <View style={styles.divider} />

              <View style={styles.salaryRow}>
                <Text style={styles.salaryLabel}>Базовая ставка ({data.shifts.length} смен):</Text>
                <Text style={styles.salaryValue}>{formatNum(data.base)} ₽</Text>
              </View>
              <View style={styles.salaryRow}>
                <Text style={styles.salaryLabel}>Процент:</Text>
                <Text style={[styles.salaryValue, { color: COLORS.green }]}>+{formatNum(data.percent)} ₽</Text>
              </View>
              {data.totalDiff !== 0 && (
                <View style={styles.salaryRow}>
                  <Text style={styles.salaryLabel}>Пересдача/Недосдача:</Text>
                  <Text style={[styles.salaryValue, { color: data.totalDiff >= 0 ? COLORS.green : COLORS.red }]}>
                    {data.totalDiff > 0 ? '+' : ''}{formatNum(data.totalDiff)} ₽
                  </Text>
                </View>
              )}
  


              {/* Взято товарами — с детализацией */}
              <View style={styles.salaryRow}>
                <Text style={styles.salaryLabel}>Взято товарами:</Text>
                <Text style={[styles.salaryValue, { color: COLORS.red }]}>-{formatNum(data.goodsExpenses)} ₽</Text>
              </View>
              {data.goodsDetails && data.goodsDetails.length > 0 && (
                <View style={styles.goodsDetailsBlock}>
                  {data.goodsDetails.map((g, i) => (
                    <Text key={i} style={styles.goodsDetailText}>
                      {g.name}: {g.quantity} шт — {formatNum(g.total)} ₽
                    </Text>
                  ))}
                </View>
              )}

              <View style={styles.salaryRow}>
                <Text style={styles.salaryLabel}>Взято деньгами:</Text>
                <Text style={[styles.salaryValue, { color: COLORS.red }]}>-{formatNum(data.cashExpenses)} ₽</Text>
              </View>

              {/* Уборщица */}
              {data.shifts.reduce((sum, s) => sum + (s.cleanerAmount || 0), 0) > 0 && (
                <View style={styles.salaryRow}>
                  <Text style={styles.salaryLabel}>Уборщица:</Text>
                  <Text style={[styles.salaryValue, { color: COLORS.green }]}>
                    +{formatNum(data.shifts.reduce((sum, s) => sum + (s.cleanerAmount || 0), 0))} ₽
                  </Text>
                </View>
              )}

              {data.fines.length > 0 && (
                <View style={styles.salaryRow}>
                  <Text style={styles.salaryLabel}>Штрафы ({data.fines.length}):</Text>
                  <Text style={[styles.salaryValue, { color: COLORS.red }]}>
                    -{formatNum(data.fines.reduce((s, f) => s + f.amount, 0))} ₽
                  </Text>
                </View>
              )}

              <View style={styles.totalDivider} />
              <View style={styles.salaryRow}>
                <Text style={styles.salaryTotalLabel}>Итого к выплате:</Text>
                <Text style={[styles.salaryTotalValue, { color: data.total >= 0 ? COLORS.green : COLORS.red }]}>
                  {formatNum(data.total)} ₽
                </Text>
              </View>
            </View>
          ))}

          {/* Сводка по товарам */}
          {(() => {
            const allGoods: Record<string, { quantity: number; total: number }> = {};
            Object.values(salaryData).forEach(data => {
              if (data.goodsDetails) {
                data.goodsDetails.forEach(g => {
                  if (!allGoods[g.name]) allGoods[g.name] = { quantity: 0, total: 0 };
                  allGoods[g.name].quantity += g.quantity || 0;
                  allGoods[g.name].total += g.total || 0;
                });
              }
            });
            const goodsNames = Object.keys(allGoods);
            if (goodsNames.length === 0) return null;
            return (
              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Сводка по товарам</Text>
                {goodsNames.map(name => (
                  <View key={name} style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>{name}</Text>
                    <Text style={styles.summaryValue}>{allGoods[name].quantity} шт — {formatNum(allGoods[name].total)} ₽</Text>
                  </View>
                ))}
              </View>
            );
          })()}

          {/* Сводка по уборщице */}
          {(() => {
            let totalCleaner = 0;
            Object.values(salaryData).forEach(data => {
              data.shifts.forEach(s => {
                totalCleaner += s.cleanerAmount || 0;
              });
            });
            if (totalCleaner === 0) return null;
            return (
              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Уборщица</Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Выплачено уборщице:</Text>
                  <Text style={[styles.summaryValue, { color: COLORS.red }]}>
                    {formatNum(totalCleaner)} ₽
                  </Text>
                </View>
              </View>
            );
          })()}

          <TouchableOpacity style={[styles.payBtn, paying && { opacity: 0.5 }]} onPress={handlePaySalary} disabled={paying}>
            <Text style={styles.payBtnText}>{paying ? '⏳ Выплата...' : '💸 Выплатить зарплату'}</Text>
          </TouchableOpacity>

          {Object.keys(salaryData).length > 0 && (
            <TouchableOpacity style={styles.exportBtn} onPress={() => exportSalaryToExcel(salaryData, fromDate, toDate)}>
              <Text style={styles.exportBtnText}>📥 Скачать Excel</Text>
            </TouchableOpacity>
          )}

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
  center: { flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: COLORS.textDim, fontSize: 14, marginTop: 12 },
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
  goodsDetailsBlock: { paddingLeft: 16, marginBottom: 8 },
  goodsDetailText: { color: COLORS.textDim, fontSize: 12, marginBottom: 2 },
  totalDivider: { height: 2, backgroundColor: COLORS.green, marginVertical: 8 },
  salaryTotalLabel: { color: COLORS.text, fontSize: 16, fontWeight: '700', flex: 1 },
  salaryTotalValue: { fontSize: 22, fontWeight: '700' },
  payBtn: { backgroundColor: '#1a3a2a', borderWidth: 2, borderColor: COLORS.green, borderRadius: 14, padding: 18, alignItems: 'center', marginVertical: 16 },
  payBtnText: { color: COLORS.green, fontSize: 18, fontWeight: '700' },
  summaryCard: { backgroundColor: COLORS.greenBg, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: COLORS.green, marginTop: 8 },
  summaryTitle: { color: COLORS.green, fontSize: 17, fontWeight: '700', marginBottom: 10 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  summaryLabel: { color: COLORS.text, fontSize: 14 },
  summaryValue: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  lockedCard: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  lockedIcon: { fontSize: 60, marginBottom: 20 },
  lockedTitle: { color: COLORS.text, fontSize: 22, fontWeight: '700', marginBottom: 10 },
  lockedText: { color: COLORS.textDim, fontSize: 14, textAlign: 'center' },
  exportBtn: {
  backgroundColor: COLORS.card,
  borderWidth: 1,
  borderColor: COLORS.green,
  borderRadius: 14,
  padding: 16,
  alignItems: 'center',
  marginBottom: 16,
},
exportBtnText: {
  color: COLORS.green,
  fontSize: 16,
  fontWeight: '700',
},
});