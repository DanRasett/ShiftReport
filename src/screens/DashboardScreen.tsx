import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MetricPill, ScreenHeader, ScreenLayout, SectionTitle, SurfaceCard, useResponsiveLayout } from '../ui/layout';
import { COLORS } from '../ui/theme';
import { SavedReport } from '../types';
import { getHistory } from '../utils/storage';

const formatNum = (value: number) => value.toLocaleString('ru-RU');

export default function DashboardScreen() {
  const layout = useResponsiveLayout();
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    setLoading(true);
    const data = await getHistory();
    setReports(data);
    setLoading(false);
  };

  if (loading) {
    return (
      <ScreenLayout scroll={false}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.stateText}>Собираем сводку по отчетам...</Text>
        </View>
      </ScreenLayout>
    );
  }

  const totalCash = reports.reduce((sum, report) => sum + report.factCash, 0);
  const totalCashless = reports.reduce((sum, report) => sum + report.factCashless, 0);
  const totalCleaner = reports.reduce((sum, report) => sum + (report.cleanerAmount || 0), 0);
  const totalRevenue = totalCash + totalCashless + totalCleaner;
  const averageRevenue = reports.length > 0 ? Math.round(totalRevenue / reports.length) : 0;

  const last7Days = reports.filter((report) => {
    const date = new Date(report.date);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return date >= weekAgo;
  });

  const weekRevenue = last7Days.reduce((sum, report) => sum + report.factTotal, 0);
  const weekCash = last7Days.reduce((sum, report) => sum + report.factCash, 0);
  const weekCashless = last7Days.reduce((sum, report) => sum + report.factCashless, 0);

  const goodsMap: Record<string, number> = {};
  reports.forEach((report) => {
    report.goodsTaken?.forEach((good) => {
      goodsMap[good.name] = (goodsMap[good.name] || 0) + (good.quantity || 0);
    });
  });

  const topGoods = Object.entries(goodsMap)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5);

  const workerShifts: Record<string, number> = {};
  reports.forEach((report) => {
    const worker = report.workerName || 'Неизвестный сотрудник';
    workerShifts[worker] = (workerShifts[worker] || 0) + 1;
  });

  const topWorkers = Object.entries(workerShifts)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6);

  return (
    <ScreenLayout>
      <ScreenHeader
        title="Дашборд"
        subtitle="Общая картина по выручке, активным сменам и самым частым операциям за весь период."
      />

      <SurfaceCard style={styles.heroCard}>
        <View style={[styles.heroContent, layout.isDesktop && styles.heroContentDesktop]}>
          <View style={styles.heroMain}>
            <Text style={styles.heroEyebrow}>Операционный итог</Text>
            <Text style={styles.heroAmount}>{formatNum(totalRevenue)} ₽</Text>
            <Text style={styles.heroCaption}>
              Сумма наличных, безнала и выплат уборщице по всем сохраненным отчетам.
            </Text>
          </View>
          <View style={[styles.heroStats, layout.isDesktop && styles.heroStatsDesktop]}>
            <MetricPill label="Всего смен" value={String(reports.length)} accent />
            <MetricPill label="Средняя смена" value={`${formatNum(averageRevenue)} ₽`} />
            <MetricPill label="Наличные" value={`${formatNum(totalCash)} ₽`} />
            <MetricPill label="Безнал" value={`${formatNum(totalCashless)} ₽`} />
          </View>
        </View>
      </SurfaceCard>

      <View style={[styles.mainGrid, layout.isDesktop && styles.mainGridDesktop]}>
        <View style={styles.primaryColumn}>
          <SurfaceCard style={styles.sectionCard}>
            <SectionTitle
              eyebrow="7 дней"
              title="Последняя неделя"
              subtitle="Быстрая выжимка по свежим сменам для ежедневного контроля."
            />
            <View style={styles.metricsGrid}>
              <MetricPill label="Выручка" value={`${formatNum(weekRevenue)} ₽`} accent />
              <MetricPill label="Смен" value={String(last7Days.length)} />
              <MetricPill label="Наличные" value={`${formatNum(weekCash)} ₽`} />
              <MetricPill label="Безнал" value={`${formatNum(weekCashless)} ₽`} />
            </View>
          </SurfaceCard>

          <SurfaceCard style={styles.sectionCard}>
            <SectionTitle
              eyebrow="Товары"
              title="Топ позиций"
              subtitle="Что чаще всего уходит под зарплату или списывается вместе со сменой."
            />
            {topGoods.length > 0 ? (
              topGoods.map(([name, quantity], index) => (
                <View key={name} style={styles.listRow}>
                  <Text style={styles.listIndex}>{String(index + 1).padStart(2, '0')}</Text>
                  <Text style={styles.listTitle}>{name}</Text>
                  <Text style={styles.listValue}>{quantity} шт</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>Пока нет данных по списанию товаров.</Text>
            )}
          </SurfaceCard>
        </View>

        <View style={styles.secondaryColumn}>
          <SurfaceCard style={styles.sectionCard}>
            <SectionTitle
              eyebrow="Команда"
              title="Смены по сотрудникам"
              subtitle="Сразу видно, кто закрывал больше всего смен за период."
            />
            {topWorkers.length > 0 ? (
              topWorkers.map(([name, count]) => (
                <View key={name} style={styles.workerRow}>
                  <View style={styles.workerBadge}>
                    <Text style={styles.workerBadgeText}>{name.slice(0, 1).toUpperCase()}</Text>
                  </View>
                  <Text style={styles.workerName}>{name}</Text>
                  <Text style={styles.workerCount}>{count} смен</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>История еще пустая, список сотрудников появится после первых смен.</Text>
            )}
          </SurfaceCard>

          <SurfaceCard style={styles.sectionCard}>
            <SectionTitle
              eyebrow="Баланс"
              title="Структура выручки"
              subtitle="Сколько денег проходит через каждую категорию учета."
            />
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>Наличные</Text>
              <Text style={styles.balanceValue}>{formatNum(totalCash)} ₽</Text>
            </View>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>Безнал</Text>
              <Text style={styles.balanceValue}>{formatNum(totalCashless)} ₽</Text>
            </View>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>Уборщица</Text>
              <Text style={styles.balanceValue}>{formatNum(totalCleaner)} ₽</Text>
            </View>
            <View style={[styles.balanceRow, styles.balanceTotalRow]}>
              <Text style={styles.balanceTotalLabel}>Общий итог</Text>
              <Text style={styles.balanceTotalValue}>{formatNum(totalRevenue)} ₽</Text>
            </View>
          </SurfaceCard>
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
    gap: 12,
  },
  stateText: {
    color: COLORS.textMuted,
    fontSize: 15,
  },
  heroCard: {
    marginBottom: 18,
    backgroundColor: COLORS.backgroundAlt,
  },
  heroContent: {
    gap: 18,
  },
  heroContentDesktop: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  heroMain: {
    flex: 1.1,
    minHeight: 220,
    justifyContent: 'space-between',
  },
  heroEyebrow: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  heroAmount: {
    color: COLORS.text,
    fontSize: 46,
    fontWeight: '800',
    letterSpacing: -1.6,
    marginTop: 12,
  },
  heroCaption: {
    color: COLORS.textMuted,
    fontSize: 15,
    lineHeight: 24,
    marginTop: 10,
    maxWidth: 520,
  },
  heroStats: {
    gap: 12,
  },
  heroStatsDesktop: {
    flex: 1,
    justifyContent: 'space-between',
  },
  mainGrid: {
    gap: 18,
  },
  mainGridDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  primaryColumn: {
    flex: 1.2,
    gap: 18,
  },
  secondaryColumn: {
    flex: 0.9,
    gap: 18,
  },
  sectionCard: {
    gap: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
    gap: 12,
  },
  listIndex: {
    width: 28,
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  listTitle: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
  listValue: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  workerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },
  workerBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.surfaceStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workerBadgeText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '800',
  },
  workerName: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
  workerCount: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },
  balanceLabel: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  balanceValue: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  balanceTotalRow: {
    marginTop: 8,
    borderBottomWidth: 0,
    paddingTop: 16,
  },
  balanceTotalLabel: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  balanceTotalValue: {
    color: COLORS.accent,
    fontSize: 24,
    fontWeight: '800',
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
});
