import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SavedReport } from '../types';
import { getHistory } from '../utils/storage';

const COLORS = {
  bg: '#1a1d23',
  card: '#21242b',
  border: '#2a2d35',
  text: '#e0e0e0',
  textDim: '#8b8d94',
  green: '#4caf93',
  red: '#e0556a',
  yellow: '#f0c040',
};

const formatNum = (n: number) => n.toLocaleString('ru-RU');
const formatDate = (iso: string) => {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${day}.${month} ${hours}:${mins}`;
};

export default function HistoryScreen() {
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      getHistory().then(setReports);
    }, [])
  );

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const renderReport = ({ item }: { item: SavedReport }) => {
    const isExpanded = expandedId === item.id;
    const isPaid = item.salaryPaid === true;
    const diffText =
      item.difference > 0
        ? `Пересдача: +${formatNum(item.difference)} ₽`
        : item.difference < 0
        ? `Недосдача: ${formatNum(item.difference)} ₽`
        : `0 ₽`;
    const diffColor = item.difference >= 0 ? COLORS.green : COLORS.red;

    return (
      <TouchableOpacity style={styles.reportCard} onPress={() => toggleExpand(item.id)} activeOpacity={0.7}>
        <View style={styles.reportHeader}>
          <Text style={styles.reportDate}>{formatDate(item.date)}</Text>
          <View style={styles.workerCol}>
            <Text style={styles.reportWorker}>{item.workerName || '—'}</Text>
            {isPaid && <Text style={styles.paidBadge}>💰 Выплачено</Text>}
          </View>
          <Text style={styles.reportFact}>{formatNum(item.factTotal)} ₽</Text>
          <Text style={[styles.reportDiff, { color: diffColor }]}>{diffText}</Text>
          <Text style={styles.arrow}>{isExpanded ? '▾' : '▸'}</Text>
        </View>
        {isExpanded && (
          <View style={styles.details}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailText}>Сотрудник: {item.workerName || '—'}</Text>
              {isPaid && <Text style={styles.paidBadge}>💰 Зарплата выплачена</Text>}
            </View>
            <Text style={styles.detailText}>
              Дэш: {formatNum(item.dashTotal)} ₽ (Нал: {formatNum(item.dashCash)}, Карта: {formatNum(item.dashCashless)})
            </Text>
            <Text style={styles.detailText}>
              Факт: {formatNum(item.factTotal)} ₽ (Нал: {formatNum(item.factCash)}, Карта: {formatNum(item.factCashless)})
            </Text>
            <Text style={styles.detailText}>2%: {formatNum(item.twoPercent)} ₽</Text>

            {item.goodsTaken && item.goodsTaken.length > 0 && (
              <View style={styles.expensesBlock}>
                <Text style={styles.detailText}>Взято товарами:</Text>
                {item.goodsTaken.map((g, i) => (
                  <Text key={i} style={styles.expenseDetail}>
                    {g.name} ×{g.quantity} = {formatNum(g.quantity * g.price)} ₽
                  </Text>
                ))}
              </View>
            )}

            {item.cashTaken != null && item.cashTaken > 0 && (
              <View style={styles.expensesBlock}>
                <Text style={styles.detailText}>Взято деньгами: {formatNum(item.cashTaken)} ₽</Text>
              </View>
            )}

            {item.expenses && item.expenses.length > 0 && (
              <View style={styles.expensesBlock}>
                <Text style={styles.detailText}>Прочие расходы:</Text>
                {item.expenses.map((e, i) => (
                  <Text key={i} style={styles.expenseDetail}>{e.name}: {e.description}</Text>
                ))}
              </View>
            )}

            {item.fine && (
              <View style={styles.expensesBlock}>
                <Text style={[styles.detailText, { color: COLORS.red }]}>
                  Штраф: {formatNum(item.fine.amount)} ₽ — {item.fine.reason}
                </Text>
              </View>
            )}

            {item.photoBase64 && (
              <View style={styles.photoBlock}>
                <Text style={styles.detailText}>📷 Чек:</Text>
                <Image source={{ uri: `data:image/jpeg;base64,${item.photoBase64}` }} style={styles.reportPhoto} />
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {reports.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Нет сохранённых отчётов</Text>
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => item.id}
          renderItem={renderReport}
          contentContainerStyle={{ padding: 16 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  reportCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  reportHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reportDate: { color: COLORS.textDim, fontSize: 12, width: 45 },
  workerCol: { flex: 1 },
  reportWorker: { color: COLORS.green, fontSize: 13, fontWeight: '600' },
  paidBadge: {
    color: COLORS.yellow,
    fontSize: 10,
    fontWeight: '700',
    backgroundColor: '#2a2a1a',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  reportFact: { color: COLORS.text, fontSize: 13, fontWeight: '600' },
  reportDiff: { fontSize: 12, fontWeight: '600' },
  arrow: { color: COLORS.textDim, fontSize: 16, width: 20, textAlign: 'center' },
  details: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border, gap: 4 },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  detailText: { color: COLORS.textDim, fontSize: 13 },
  expensesBlock: { marginTop: 6 },
  expenseDetail: { color: COLORS.textDim, fontSize: 12, marginLeft: 12 },
  photoBlock: { marginTop: 8 },
  reportPhoto: { width: '100%', height: 180, borderRadius: 8, marginTop: 6, resizeMode: 'cover' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: COLORS.textDim, fontSize: 16 },
});