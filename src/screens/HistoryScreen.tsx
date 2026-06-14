import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { SavedReport } from '../types';
import { getHistory, deleteReport } from '../utils/storage';
import { exportHistoryToExcel, getReportText } from '../utils/export';
import { useAuth } from '../utils/AuthContext';

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
  const { userRoles } = useAuth();
  const navigation = useNavigation<any>();

  const isManager = userRoles.some(r =>
    r.toLowerCase().includes('manager') || r.toLowerCase().includes('owner') || r.toLowerCase().includes('admin')
  );

  const canEdit = (report: SavedReport) => {
    if (isManager) return true;
    const daysSinceReport = (Date.now() - new Date(report.date).getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceReport < 2;
  };

  const canDelete = (report: SavedReport) => {
    if (isManager) return true;
    const daysSinceReport = (Date.now() - new Date(report.date).getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceReport < 2;
  };

  useFocusEffect(
    useCallback(() => {
      getHistory().then(setReports);
    }, [])
  );

  const copyReport = async (report: SavedReport) => {
    const text = getReportText(report);
    if (Platform.OS === 'web') {
      await navigator.clipboard.writeText(text);
    } else {
      await Clipboard.setStringAsync(text);
    }
    Alert.alert('Скопировано', 'Текст отчёта скопирован в буфер обмена');
  };

  const handleExport = () => {
    if (reports.length === 0) {
      Alert.alert('Нет данных', 'Нет отчётов для экспорта');
      return;
    }
    exportHistoryToExcel(reports);
  };

  const handleDelete = (report: SavedReport) => {
    Alert.alert(
      'Удаление отчёта',
      `Вы уверены, что хотите удалить отчёт от ${formatDate(report.date)}?`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            await deleteReport(report.id);
            setReports(prev => prev.filter(r => r.id !== report.id));
            Alert.alert('Удалено', 'Отчёт удалён');
          },
        },
      ]
    );
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const renderReport = ({ item }: { item: SavedReport }) => {
    const isExpanded = expandedId === item.id;
    const isPaid = item.salaryPaid === true;
    const editable = canEdit(item);
    const deletable = canDelete(item);
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
          <TouchableOpacity style={styles.copyBtn} onPress={() => copyReport(item)}>
            <Text style={styles.copyBtnText}>📋</Text>
          </TouchableOpacity>
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
            {item.transfers ? <Text style={styles.detailText}>Переводы: {formatNum(item.transfers)} ₽</Text> : null}
            <Text style={styles.detailText}>2%: {formatNum(item.twoPercent)} ₽</Text>
            {item.cleanerAmount != null && item.cleanerAmount > 0 && (
              <View style={styles.expensesBlock}>
                <Text style={styles.detailText}>Уборщица: {formatNum(item.cleanerAmount)} ₽</Text>
              </View>
            )}

            {item.goodsTaken && item.goodsTaken.length > 0 && (
              <View style={styles.expensesBlock}>
                <Text style={styles.detailText}>Взято товарами:</Text>
                {item.goodsTaken.map((g, i) => (
                  <Text key={i} style={styles.expenseDetail}>
                    {g.workerName ? `${g.workerName}: ` : ''}{g.name} ×{g.quantity} = {formatNum(g.quantity * g.price)} ₽
                  </Text>
                ))}
              </View>
            )}

            {item.cashTakenItems && item.cashTakenItems.length > 0 && (
              <View style={styles.expensesBlock}>
                <Text style={styles.detailText}>Взято деньгами:</Text>
                {item.cashTakenItems.map((c, i) => (
                  <Text key={i} style={styles.expenseDetail}>
                    {c.workerName ? `${c.workerName}: ` : ''}{formatNum(c.amount)} ₽
                  </Text>
                ))}
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

            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.exportBtn} onPress={() => copyReport(item)}>
                <Text style={styles.exportBtnText}>📋 Копировать</Text>
              </TouchableOpacity>
              {editable && (
                <TouchableOpacity
                  style={[styles.exportBtn, { borderColor: COLORS.yellow }]}
                  onPress={() => navigation.navigate('EditReport', { reportId: item.id })}
                >
                  <Text style={[styles.exportBtnText, { color: COLORS.yellow }]}>✏️ Изменить</Text>
                </TouchableOpacity>
              )}
              {deletable && (
                <TouchableOpacity
                  style={[styles.exportBtn, { borderColor: COLORS.red }]}
                  onPress={() => handleDelete(item)}
                >
                  <Text style={[styles.exportBtnText, { color: COLORS.red }]}>🗑️ Удалить</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.countText}>Всего: {reports.length} смен</Text>
        <TouchableOpacity style={styles.topExportBtn} onPress={handleExport}>
          <Text style={styles.topExportBtnText}>📥 Excel</Text>
        </TouchableOpacity>
      </View>

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
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10, backgroundColor: COLORS.card,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  countText: { color: COLORS.textDim, fontSize: 13 },
  topExportBtn: { backgroundColor: COLORS.green, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 14 },
  topExportBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  reportCard: {
    backgroundColor: COLORS.card, borderRadius: 12, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: COLORS.border,
  },
  reportHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reportDate: { color: COLORS.textDim, fontSize: 12, width: 45 },
  workerCol: { flex: 1 },
  reportWorker: { color: COLORS.green, fontSize: 13, fontWeight: '600' },
  paidBadge: {
    color: COLORS.yellow, fontSize: 10, fontWeight: '700',
    backgroundColor: '#2a2a1a', paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 4, alignSelf: 'flex-start', marginTop: 2,
  },
  reportFact: { color: COLORS.text, fontSize: 13, fontWeight: '600' },
  reportDiff: { fontSize: 12, fontWeight: '600' },
  copyBtn: { padding: 4 },
  copyBtnText: { fontSize: 16 },
  arrow: { color: COLORS.textDim, fontSize: 16, width: 20, textAlign: 'center' },
  details: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border, gap: 4 },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  detailText: { color: COLORS.textDim, fontSize: 13 },
  expensesBlock: { marginTop: 6 },
  expenseDetail: { color: COLORS.textDim, fontSize: 12, marginLeft: 12 },
  actionButtons: { flexDirection: 'row', gap: 8, marginTop: 8 },
  exportBtn: {
    flex: 1, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.green,
    borderRadius: 10, padding: 10, alignItems: 'center',
  },
  exportBtnText: { color: COLORS.green, fontSize: 14, fontWeight: '600' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: COLORS.textDim, fontSize: 16 },
});