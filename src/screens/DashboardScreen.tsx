import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Dimensions, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LineChart, PieChart } from 'react-native-chart-kit';
import { getHistory } from '../utils/storage';
import { SavedReport } from '../types';

const screenWidth = Dimensions.get('window').width;

const COLORS = {
  bg: '#1a1d23', card: '#21242b', border: '#2a2d35', text: '#e0e0e0',
  textDim: '#8b8d94', green: '#4caf93', red: '#e0556a', yellow: '#f0c040',
  blue: '#4c8baf', purple: '#8b4caf', orange: '#af8b4c',
};

const formatNum = (n: number) => n.toLocaleString('ru-RU');

export default function DashboardScreen() {
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
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.green} />
      </View>
    );
  }

  // Последние 7 дней для графика
  const last7Days = reports
    .filter(r => {
      const date = new Date(r.date);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return date >= weekAgo;
    })
    .reverse();

  const chartLabels = last7Days.map(r => {
    const d = new Date(r.date);
    return `${d.getDate()}.${d.getMonth() + 1}`;
  });

  const chartData = last7Days.map(r => r.factTotal);

  // Статистика за всё время
  const totalCash = reports.reduce((s, r) => s + r.factCash, 0);
  const totalCashless = reports.reduce((s, r) => s + r.factCashless, 0);
  const totalCleaner = reports.reduce((s, r) => s + (r.cleanerAmount || 0), 0);

  const pieData = [
    { name: 'Наличные', amount: totalCash, color: COLORS.green, legendFontColor: COLORS.textDim, legendFontSize: 12 },
    { name: 'Безнал', amount: totalCashless, color: COLORS.blue, legendFontColor: COLORS.textDim, legendFontSize: 12 },
    { name: 'Уборщица', amount: totalCleaner, color: COLORS.orange, legendFontColor: COLORS.textDim, legendFontSize: 12 },
  ].filter(d => d.amount > 0);

  // Топ товаров, взятых под ЗП
  const goodsMap: Record<string, number> = {};
  reports.forEach(r => {
    if (r.goodsTaken) {
      r.goodsTaken.forEach(g => {
        goodsMap[g.name] = (goodsMap[g.name] || 0) + (g.quantity || 0);
      });
    }
  });
  const topGoods = Object.entries(goodsMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Смены по сотрудникам
  const workerShifts: Record<string, number> = {};
  reports.forEach(r => {
    const w = r.workerName || 'Неизвестный';
    workerShifts[w] = (workerShifts[w] || 0) + 1;
  });

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Дашборд</Text>

      {/* График выручки */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Выручка за 7 дней</Text>
        {chartData.length > 0 ? (
          <LineChart
            data={{
              labels: chartLabels,
              datasets: [{ data: chartData.length ? chartData : [0] }],
            }}
            width={screenWidth - 64}
            height={200}
            yAxisLabel=""
            chartConfig={{
              backgroundColor: COLORS.card,
              backgroundGradientFrom: COLORS.card,
              backgroundGradientTo: COLORS.card,
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(76, 175, 147, ${opacity})`,
              labelColor: () => COLORS.textDim,
              propsForDots: { r: '4', strokeWidth: '2', stroke: COLORS.green },
            }}
            bezier
            style={styles.chart}
          />
        ) : (
          <Text style={styles.emptyText}>Нет данных за 7 дней</Text>
        )}
      </View>

      {/* Круговая диаграмма */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Распределение (всего)</Text>
        {pieData.length > 0 ? (
          <PieChart
            data={pieData.map(d => ({
              name: d.name,
              population: d.amount,
              color: d.color,
              legendFontColor: COLORS.textDim,
              legendFontSize: 12,
            }))}
            width={screenWidth - 64}
            height={180}
            chartConfig={{}}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="15"
          />
        ) : (
          <Text style={styles.emptyText}>Нет данных</Text>
        )}
      </View>

      {/* Топ товаров под ЗП */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Топ товаров под ЗП</Text>
        {topGoods.length > 0 ? (
          topGoods.map(([name, qty], i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.rank}>#{i + 1}</Text>
              <Text style={styles.goodsName}>{name}</Text>
              <Text style={styles.goodsQty}>{qty} шт</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>Товары не брали</Text>
        )}
      </View>

      {/* Смены по сотрудникам */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Смены по сотрудникам</Text>
        {Object.entries(workerShifts).map(([name, count], i) => (
          <View key={i} style={styles.row}>
            <Text style={styles.workerName}>{name}</Text>
            <Text style={styles.shiftCount}>{count} смен</Text>
          </View>
        ))}
      </View>

      {/* Общая статистика */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Общая статистика</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Всего смен:</Text>
          <Text style={styles.value}>{reports.length}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Выручка нал:</Text>
          <Text style={styles.value}>{formatNum(totalCash)} ₽</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Выручка безнал:</Text>
          <Text style={styles.value}>{formatNum(totalCashless)} ₽</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Уборщица:</Text>
          <Text style={styles.value}>{formatNum(totalCleaner)} ₽</Text>
        </View>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 16 },
  center: { flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center' },
  title: { color: COLORS.text, fontSize: 24, fontWeight: '700', marginBottom: 16 },
  card: { backgroundColor: COLORS.card, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  cardTitle: { color: COLORS.text, fontSize: 16, fontWeight: '600', marginBottom: 12 },
  chart: { borderRadius: 8, marginTop: 8 },
  emptyText: { color: COLORS.textDim, fontSize: 14, textAlign: 'center', padding: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  rank: { color: COLORS.green, fontSize: 14, fontWeight: '700', width: 30 },
  goodsName: { color: COLORS.text, fontSize: 14, flex: 1 },
  goodsQty: { color: COLORS.textDim, fontSize: 14 },
  workerName: { color: COLORS.text, fontSize: 14, flex: 1 },
  shiftCount: { color: COLORS.green, fontSize: 14, fontWeight: '600' },
  label: { color: COLORS.textDim, fontSize: 14 },
  value: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
});