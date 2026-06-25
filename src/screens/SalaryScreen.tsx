import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SavedReport } from '../types';
import {
  ScreenHeader,
  ScreenLayout,
  SectionTitle,
  SurfaceCard,
  sharedInputStyles,
  sharedTextStyles,
  useResponsiveLayout,
} from '../ui/layout';
import { COLORS } from '../ui/theme';
import { exportSalaryToExcel } from '../utils/export';
import { loginToSmartShell, getUserRole } from '../utils/smartshell';
import {
  getAllUnpaidFines,
  getCredentials,
  getUnpaidReports,
  getWorkersWithSettings,
  markSalaryPaid,
} from '../utils/storage';

const formatNum = (value: number) => value.toLocaleString('ru-RU');

interface WorkerData {
  base: number;
  percent: number;
  goodsExpenses: number;
  cashExpenses: number;
  totalDiff: number;
  fines: { amount: number; reason: string; date: string }[];
  total: number;
  shifts: SavedReport[];
  goodsDetails: { name: string; quantity: number; total: number }[];
}

export default function SalaryScreen() {
  const layout = useResponsiveLayout();
  const [roles, setRoles] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [salaryData, setSalaryData] = useState<Record<string, WorkerData>>({});
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [paying, setPaying] = useState(false);

  useFocusEffect(
    useCallback(() => {
      checkRole();
    }, [])
  );

  const checkRole = async () => {
    setLoading(true);
    const credentials = await getCredentials();
    if (credentials) {
      await loginToSmartShell(credentials);
      setRoles(await getUserRole());
    }
    setLoading(false);
  };

  const isManagerOrOwner = () => roles.some((role) => {
    const normalized = role.toLowerCase();
    return normalized.includes('manager') || normalized.includes('owner') || normalized.includes('admin');
  });

  const calculate = async () => {
    if (!fromDate || !toDate) {
      Alert.alert('Ошибка', 'Введите обе даты периода.');
      return;
    }

    setCalculating(true);

    try {
      const [fromDay, fromMonth, fromYear] = fromDate.split('.').map(Number);
      const [toDay, toMonth, toYear] = toDate.split('.').map(Number);
      const from = `${fromYear}-${String(fromMonth).padStart(2, '0')}-${String(fromDay).padStart(2, '0')}`;
      const to = `${toYear}-${String(toMonth).padStart(2, '0')}-${String(toDay).padStart(2, '0')}`;

      const [allReports, allUnpaidFines, workersSettings] = await Promise.all([
        getUnpaidReports(),
        getAllUnpaidFines(),
        getWorkersWithSettings(),
      ]);

      const workerSettingsMap: Record<
        string,
        { baseSalary: number; calculatePercent: boolean; includeInSalary: boolean }
      > = {};

      workersSettings.forEach((worker: any) => {
        const fullName = [worker.first_name, worker.last_name].filter(Boolean).join(' ');
        if (fullName) {
          workerSettingsMap[fullName] = {
            baseSalary: Number(worker.base_salary) || 1400,
            calculatePercent: worker.calculate_percent !== false,
            includeInSalary: worker.include_in_salary !== false,
          };
        }
      });

      const filteredReports = allReports.filter((report) => {
        const reportDate = report.date.substring(0, 10);
        return reportDate >= from && reportDate <= to;
      });

      if (filteredReports.length === 0) {
        Alert.alert('Нет данных', 'За выбранный период нет неоплаченных отчетов.');
        setCalculating(false);
        return;
      }

      const byWorker: Record<string, SavedReport[]> = {};
      filteredReports.forEach((report) => {
        const worker = report.workerName || 'Неизвестный сотрудник';
        const settings = workerSettingsMap[worker];
        if (settings && !settings.includeInSalary) return;
        if (!byWorker[worker]) byWorker[worker] = [];
        byWorker[worker].push(report);
      });

      const result: Record<string, WorkerData> = {};
      const emptyWorkerData = (): WorkerData => ({
        base: 0,
        percent: 0,
        goodsExpenses: 0,
        cashExpenses: 0,
        totalDiff: 0,
        fines: [],
        total: 0,
        shifts: [],
        goodsDetails: [],
      });

      Object.keys(byWorker).forEach((worker) => {
        result[worker] = emptyWorkerData();
      });

      Object.entries(byWorker).forEach(([worker, shifts]) => {
        const settings = workerSettingsMap[worker] || {
          baseSalary: 1400,
          calculatePercent: true,
          includeInSalary: true,
        };

        shifts.forEach((shift) => {
          result[worker].base += settings.baseSalary;
          if (settings.calculatePercent) {
            result[worker].percent += shift.twoPercent || 0;
          }
          result[worker].totalDiff += shift.difference || 0;
          result[worker].shifts.push(shift);

          if (shift.fine) {
            result[worker].fines.push({
              amount: shift.fine.amount,
              reason: shift.fine.reason,
              date: shift.date.substring(0, 10),
            });
          }

          shift.goodsTaken?.forEach((item) => {
            const takenByWorker = (item.workerName || worker).trim();
            const amount = (item.quantity || 0) * (item.price || 0);
            if (!result[takenByWorker]) {
              result[takenByWorker] = emptyWorkerData();
            }

            const existingGood = result[takenByWorker].goodsDetails.find((entry) => entry.name === item.name);
            if (existingGood) {
              existingGood.quantity += item.quantity || 0;
              existingGood.total += amount;
            } else {
              result[takenByWorker].goodsDetails.push({
                name: item.name,
                quantity: item.quantity || 0,
                total: amount,
              });
            }

            if (takenByWorker !== worker) {
              result[takenByWorker].goodsExpenses += amount;
            } else {
              result[worker].goodsExpenses += amount;
            }
          });

          shift.cashTakenItems?.forEach((item) => {
            const takenByWorker = (item.workerName || worker).trim();
            const amount = item.amount || 0;
            if (takenByWorker && takenByWorker !== worker) {
              if (!result[takenByWorker]) {
                result[takenByWorker] = emptyWorkerData();
              }
              result[takenByWorker].cashExpenses += amount;
            } else {
              result[worker].cashExpenses += amount;
            }
          });
        });
      });

      Object.keys(result).forEach((worker) => {
        const workerFines = allUnpaidFines.filter((fine) => {
          return fine.workerName === worker && fine.date.substring(0, 10) >= from && fine.date.substring(0, 10) <= to;
        });

        workerFines.forEach((fine) => {
          result[worker].fines.push({
            amount: fine.amount,
            reason: fine.reason,
            date: fine.date.substring(0, 10),
          });
        });

        const cleanerBonus = result[worker].shifts.reduce((sum, shift) => sum + (shift.cleanerAmount || 0), 0);
        const totalFines = result[worker].fines.reduce((sum, fine) => sum + fine.amount, 0);
        result[worker].total =
          result[worker].base +
          result[worker].percent +
          result[worker].totalDiff +
          cleanerBonus -
          result[worker].goodsExpenses -
          result[worker].cashExpenses -
          totalFines;
      });

      const filteredResult: Record<string, WorkerData> = {};
      Object.entries(result).forEach(([worker, data]) => {
        if (data.shifts.length > 0) {
          filteredResult[worker] = data;
        }
      });

      setSalaryData(filteredResult);
    } catch (error: any) {
      Alert.alert('Ошибка', `Не удалось рассчитать зарплату: ${error.message}`);
    }

    setCalculating(false);
  };

  const handlePaySalary = async () => {
    if (Object.keys(salaryData).length === 0) {
      Alert.alert('Нет данных', 'Сначала рассчитайте зарплату.');
      return;
    }

    const [fromDay, fromMonth, fromYear] = fromDate.split('.').map(Number);
    const [toDay, toMonth, toYear] = toDate.split('.').map(Number);
    const from = `${fromYear}-${String(fromMonth).padStart(2, '0')}-${String(fromDay).padStart(2, '0')}`;
    const to = `${toYear}-${String(toMonth).padStart(2, '0')}-${String(toDay).padStart(2, '0')}`;

    setPaying(true);
    let success = 0;
    let errors = 0;

    for (const [workerName, data] of Object.entries(salaryData)) {
      try {
        await markSalaryPaid(data.shifts.map((shift) => shift.id), workerName, from, to);
        success += 1;
      } catch (error) {
        errors += 1;
      }
    }

    setPaying(false);
    setSalaryData({});
    Alert.alert('Готово', `Выплачено: ${success}, ошибок: ${errors}`);
  };

  if (loading) {
    return (
      <ScreenLayout scroll={false}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.stateText}>Проверяем доступ к экрану зарплаты...</Text>
        </View>
      </ScreenLayout>
    );
  }

  if (!isManagerOrOwner()) {
    return (
      <ScreenLayout scroll={false}>
        <View style={styles.centerState}>
          <SurfaceCard style={styles.lockedCard}>
            <Text style={styles.lockedTitle}>Доступ ограничен</Text>
            <Text style={styles.lockedText}>Этот раздел доступен только руководителю или администратору.</Text>
          </SurfaceCard>
        </View>
      </ScreenLayout>
    );
  }

  const totalWorkers = Object.keys(salaryData).length;
  const totalSalary = Object.values(salaryData).reduce((sum, worker) => sum + worker.total, 0);

  return (
    <ScreenLayout>
      <ScreenHeader
        title="Расчет зарплаты"
        subtitle="Сводите период, проверяйте детализацию по сменам и сразу фиксируйте выплату."
      />

      <View style={[styles.mainGrid, layout.isDesktop && styles.mainGridDesktop]}>
        <View style={styles.formColumn}>
          <SurfaceCard style={styles.filterCard}>
            <SectionTitle
              eyebrow="Период"
              title="Параметры расчета"
              subtitle="Используйте формат ДД.ММ.ГГГГ. В расчет попадут только неоплаченные отчеты."
            />
            <View style={[styles.dateRow, layout.isDesktop && styles.dateRowDesktop]}>
              <View style={styles.dateField}>
                <Text style={sharedTextStyles.label}>С</Text>
                <TextInput
                  style={sharedInputStyles.input}
                  placeholder="01.06.2026"
                  placeholderTextColor={COLORS.textSoft}
                  value={fromDate}
                  onChangeText={setFromDate}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.dateField}>
                <Text style={sharedTextStyles.label}>По</Text>
                <TextInput
                  style={sharedInputStyles.input}
                  placeholder="15.06.2026"
                  placeholderTextColor={COLORS.textSoft}
                  value={toDate}
                  onChangeText={setToDate}
                  keyboardType="numeric"
                />
              </View>
            </View>
            <TouchableOpacity style={styles.primaryAction} onPress={calculate} disabled={calculating}>
              <Text style={styles.primaryActionText}>{calculating ? 'Рассчитываем...' : 'Рассчитать период'}</Text>
            </TouchableOpacity>
          </SurfaceCard>

          <SurfaceCard style={styles.summaryCard}>
            <SectionTitle
              eyebrow="Сводка"
              title="Итог периода"
              subtitle="Появится после расчета и поможет быстро проверить масштаб выплаты."
            />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Сотрудников</Text>
              <Text style={styles.summaryValue}>{totalWorkers}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>К выплате всего</Text>
              <Text style={[styles.summaryValue, styles.summaryValueAccent]}>{formatNum(totalSalary)} ₽</Text>
            </View>
            {totalWorkers > 0 ? (
              <TouchableOpacity style={styles.secondaryAction} onPress={() => exportSalaryToExcel(salaryData, fromDate, toDate)}>
                <Text style={styles.secondaryActionText}>Скачать Excel</Text>
              </TouchableOpacity>
            ) : null}
          </SurfaceCard>
        </View>

        <View style={styles.resultsColumn}>
          {totalWorkers === 0 ? (
            <SurfaceCard>
              <Text style={styles.emptyTitle}>Нет рассчитанных данных</Text>
              <Text style={styles.emptyText}>После выбора периода здесь появятся карточки сотрудников с расшифровкой зарплаты.</Text>
            </SurfaceCard>
          ) : (
            <>
              {Object.entries(salaryData).map(([worker, data]) => {
                const cleanerBonus = data.shifts.reduce((sum, shift) => sum + (shift.cleanerAmount || 0), 0);
                const totalFines = data.fines.reduce((sum, fine) => sum + fine.amount, 0);

                return (
                  <SurfaceCard key={worker} style={styles.workerCard}>
                    <View style={[styles.workerHeader, layout.isDesktop && styles.workerHeaderDesktop]}>
                      <View>
                        <Text style={styles.workerName}>{worker}</Text>
                        <Text style={styles.workerMeta}>{data.shifts.length} смен за выбранный период</Text>
                      </View>
                      <Text style={[styles.workerTotal, data.total >= 0 ? styles.totalPositive : styles.totalNegative]}>
                        {formatNum(data.total)} ₽
                      </Text>
                    </View>

                    <View style={styles.breakdownGrid}>
                      <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>Базовая ставка</Text>
                        <Text style={styles.breakdownValue}>{formatNum(data.base)} ₽</Text>
                      </View>
                      <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>Процент</Text>
                        <Text style={[styles.breakdownValue, styles.positiveText]}>+{formatNum(data.percent)} ₽</Text>
                      </View>
                      <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>Пересдача / недосдача</Text>
                        <Text style={[styles.breakdownValue, data.totalDiff >= 0 ? styles.positiveText : styles.negativeText]}>
                          {data.totalDiff > 0 ? '+' : ''}
                          {formatNum(data.totalDiff)} ₽
                        </Text>
                      </View>
                      <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>Товары</Text>
                        <Text style={[styles.breakdownValue, styles.negativeText]}>-{formatNum(data.goodsExpenses)} ₽</Text>
                      </View>
                      <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>Деньги из кассы</Text>
                        <Text style={[styles.breakdownValue, styles.negativeText]}>-{formatNum(data.cashExpenses)} ₽</Text>
                      </View>
                      <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>Уборщица</Text>
                        <Text style={[styles.breakdownValue, styles.positiveText]}>+{formatNum(cleanerBonus)} ₽</Text>
                      </View>
                      <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>Штрафы</Text>
                        <Text style={[styles.breakdownValue, styles.negativeText]}>-{formatNum(totalFines)} ₽</Text>
                      </View>
                    </View>

                    <View style={styles.detailPanel}>
                      <Text style={styles.panelTitle}>Смены</Text>
                      {data.shifts.map((shift) => {
                        const percentLabel = shift.dashTotal > 10000 ? '3%' : '2%';
                        return (
                          <Text key={shift.id} style={styles.panelText}>
                            {new Date(shift.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })} | дэш {formatNum(shift.dashTotal)} ₽ | факт {formatNum(shift.factTotal)} ₽ | {percentLabel} {formatNum(shift.twoPercent)} ₽ | {shift.difference > 0 ? '+' : ''}{formatNum(shift.difference)} ₽
                          </Text>
                        );
                      })}
                    </View>

                    {data.goodsDetails.length > 0 ? (
                      <View style={styles.detailPanel}>
                        <Text style={styles.panelTitle}>Товары по сотруднику</Text>
                        {data.goodsDetails.map((item, index) => (
                          <Text key={`${item.name}-${index}`} style={styles.panelText}>
                            {item.name}: {item.quantity} шт, {formatNum(item.total)} ₽
                          </Text>
                        ))}
                      </View>
                    ) : null}

                    {data.fines.length > 0 ? (
                      <View style={styles.detailPanel}>
                        <Text style={styles.panelTitle}>Штрафы</Text>
                        {data.fines.map((fine, index) => (
                          <Text key={`${fine.date}-${index}`} style={[styles.panelText, styles.negativeText]}>
                            {fine.date}: {formatNum(fine.amount)} ₽, {fine.reason}
                          </Text>
                        ))}
                      </View>
                    ) : null}
                  </SurfaceCard>
                );
              })}

              <TouchableOpacity style={styles.payAction} onPress={handlePaySalary} disabled={paying}>
                <Text style={styles.payActionText}>{paying ? 'Фиксируем выплату...' : 'Выплатить зарплату'}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  stateText: {
    color: COLORS.textMuted,
    fontSize: 15,
  },
  lockedCard: {
    width: '100%',
    maxWidth: 520,
    alignItems: 'center',
    gap: 8,
  },
  lockedTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '800',
  },
  lockedText: {
    color: COLORS.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  mainGrid: {
    gap: 18,
  },
  mainGridDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  formColumn: {
    flex: 0.9,
    gap: 18,
  },
  resultsColumn: {
    flex: 1.3,
    gap: 18,
  },
  filterCard: {
    gap: 16,
  },
  dateRow: {
    gap: 12,
  },
  dateRowDesktop: {
    flexDirection: 'row',
  },
  dateField: {
    flex: 1,
  },
  primaryAction: {
    backgroundColor: COLORS.accent,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryActionText: {
    color: COLORS.background,
    fontSize: 14,
    fontWeight: '800',
  },
  summaryCard: {
    gap: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },
  summaryLabel: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  summaryValue: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  summaryValueAccent: {
    color: COLORS.accent,
    fontSize: 20,
  },
  secondaryAction: {
    marginTop: 8,
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: COLORS.surfaceStrong,
  },
  secondaryActionText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
  workerCard: {
    gap: 16,
  },
  workerHeader: {
    gap: 8,
  },
  workerHeaderDesktop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  workerName: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '800',
  },
  workerMeta: {
    color: COLORS.textMuted,
    fontSize: 14,
    marginTop: 4,
  },
  workerTotal: {
    fontSize: 28,
    fontWeight: '800',
  },
  totalPositive: {
    color: COLORS.accent,
  },
  totalNegative: {
    color: COLORS.danger,
  },
  breakdownGrid: {
    gap: 10,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },
  breakdownLabel: {
    flex: 1,
    color: COLORS.textMuted,
    fontSize: 14,
  },
  breakdownValue: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  positiveText: {
    color: COLORS.accent,
  },
  negativeText: {
    color: COLORS.danger,
  },
  detailPanel: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 18,
    padding: 14,
    gap: 6,
  },
  panelTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  panelText: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  payAction: {
    backgroundColor: COLORS.accent,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
  },
  payActionText: {
    color: COLORS.background,
    fontSize: 15,
    fontWeight: '800',
  },
});
