import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getHistory } from '../utils/storage';
import { SavedReport } from '../types';

const COLORS = {
  bg: '#1a1d23', card: '#21242b', border: '#2a2d35', text: '#e0e0e0',
  textDim: '#8b8d94', green: '#4caf93', red: '#e0556a', yellow: '#f0c040',
  blue: '#4c8baf', orange: '#af8b4c',
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

  // Статистика за всё время
  const totalCash = reports.reduce((s, r) => s + r.factCash, 0);
  const totalCashless = reports.reduce((s, r) => s + r.factCashless, 0);
  const totalCleaner = reports.reduce((s, r) => s + (r.cleanerAmount || 0), 0);
  const totalRevenue = totalCash + totalCashless + totalCleaner;

  // Последние 7 дней
  const last7Days = reports
    .filter(r => {
      const date = new Date(r.date);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return date >= weekAgo;
    });

  const weekRevenue = last7Days.reduce((s, r) => s + r.factTotal, 0);
  const weekCash = last7Days.reduce((s, r) => s + r.factCash, 0);
  const weekCashless = last7Days.reduce((s, r) => s + r.factCashless, 0);

  // Топ товаров
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

  // Сотрудники
  const workerShifts: Record<string, number> = {};
  reports.forEach(r => {
    const w = r.workerName || 'Неизвестный';
    workerShifts[w] = (workerShifts[w] || 0) + 1;
  });

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Дашборд</Text>

      {/* Общая статистика */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Общая выручка</Text>
        <View style={styles.bigNumber}>
          <Text style={styles.bigNumberText}>{formatNum(totalRevenue)} ₽</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Наличные:</Text>
          <Text style={styles.value}>{formatNum(totalCash)} ₽</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Безнал:</Text>
          <Text style={styles.value}>{formatNum(totalCashless)} ₽</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Уборщица:</Text>
          <Text style={styles.value}>{formatNum(totalCleaner)} ₽</Text>
        </View>
      </View>

      {/* За 7 дней */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>За последние 7 дней</Text>
        <View style={styles.bigNumber}>
          <Text style={[styles.bigNumberText, { color: COLORS.green }]}>{formatNum(weekRevenue)} ₽</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Смен:</Text>
          <Text style={styles.value}>{last7Days.length}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Наличные:</Text>
          <Text style={styles.value}>{formatNum(weekCash)} ₽</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Безнал:</Text>
          <Text style={styles.value}>{formatNum(weekCashless)} ₽</Text>
        </View>
      </View>

      {/* Топ товаров */}
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

      {/* Сотрудники */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Смены по сотрудникам</Text>
        {Object.entries(workerShifts).map(([name, count], i) => (
          <View key={i} style={styles.row}>
            <Text style={styles.workerName}>{name}</Text>
            <Text style={styles.shiftCount}>{count} смен</Text>
          </View>
        ))}
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
  bigNumber: { alignItems: 'center', paddingVertical: 16 },
  bigNumberText: { color: COLORS.text, fontSize: 36, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  rank: { color: COLORS.green, fontSize: 14, fontWeight: '700', width: 30 },
  goodsName: { color: COLORS.text, fontSize: 14, flex: 1 },
  goodsQty: { color: COLORS.textDim, fontSize: 14 },
  workerName: { color: COLORS.text, fontSize: 14, flex: 1 },
  shiftCount: { color: COLORS.green, fontSize: 14, fontWeight: '600' },
  label: { color: COLORS.textDim, fontSize: 14 },
  value: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
  emptyText: { color: COLORS.textDim, fontSize: 14, textAlign: 'center', padding: 20 },
});