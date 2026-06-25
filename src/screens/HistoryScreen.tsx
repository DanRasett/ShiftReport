import React, { useCallback, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { SavedReport } from '../types';
import { ScreenHeader, ScreenLayout, SectionTitle, SurfaceCard, useResponsiveLayout } from '../ui/layout';
import { COLORS } from '../ui/theme';
import { exportHistoryToExcel, getReportText } from '../utils/export';
import { deleteReport, getHistory } from '../utils/storage';
import { useAuth } from '../utils/AuthContext';

const formatNum = (value: number) => value.toLocaleString('ru-RU');
const formatDate = (iso: string) => {
  const date = new Date(iso);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}.${month} ${hours}:${minutes}`;
};

export default function HistoryScreen() {
  const layout = useResponsiveLayout();
  const navigation = useNavigation<any>();
  const { userRoles } = useAuth();
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const isManager = userRoles.some((role) => {
    const normalized = role.toLowerCase();
    return normalized.includes('manager') || normalized.includes('owner') || normalized.includes('admin');
  });

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

  const loadHistory = () => {
    getHistory().then(setReports);
  };

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [])
  );

  const copyReport = async (report: SavedReport) => {
    const text = getReportText(report);
    if (Platform.OS === 'web') {
      await navigator.clipboard.writeText(text);
    } else {
      await Clipboard.setStringAsync(text);
    }
    Alert.alert('Скопировано', 'Текст отчета отправлен в буфер обмена.');
  };

  const handleExport = () => {
    if (reports.length === 0) {
      Alert.alert('Нет данных', 'Пока нет отчетов для экспорта.');
      return;
    }
    exportHistoryToExcel(reports);
  };

  const handleDelete = (report: SavedReport) => {
    const action = async () => {
      try {
        await deleteReport(report.id);
        loadHistory();
        setExpandedId(null);
      } catch (error: any) {
        Alert.alert('Ошибка', error.message);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Удалить отчет от ${formatDate(report.date)}?`)) {
        action();
      }
      return;
    }

    Alert.alert('Удаление отчета', `Удалить отчет от ${formatDate(report.date)}?`, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: action },
    ]);
  };

  return (
    <ScreenLayout>
      <ScreenHeader
        title="История отчетов"
        subtitle="Открывайте детали смен, копируйте сводки, экспортируйте в Excel и при необходимости редактируйте записи."
        right={
          <TouchableOpacity style={styles.primaryAction} onPress={handleExport}>
            <Text style={styles.primaryActionText}>Экспорт в Excel</Text>
          </TouchableOpacity>
        }
      />

      <View style={[styles.topMetrics, layout.isDesktop && styles.topMetricsDesktop]}>
        <SurfaceCard style={styles.metricCard}>
          <Text style={styles.metricLabel}>Всего смен</Text>
          <Text style={styles.metricValue}>{reports.length}</Text>
        </SurfaceCard>
        <SurfaceCard style={styles.metricCard}>
          <Text style={styles.metricLabel}>Выручка по факту</Text>
          <Text style={styles.metricValue}>{formatNum(reports.reduce((sum, report) => sum + report.factTotal, 0))} ₽</Text>
        </SurfaceCard>
      </View>

      <SurfaceCard style={styles.listCard}>
        <SectionTitle
          eyebrow="Журнал"
          title="Сохраненные отчеты"
          subtitle="На desktop карточки растягиваются в полноценные строки с удобными действиями справа."
        />

        {reports.length === 0 ? (
          <View style={styles.emptyBlock}>
            <Text style={styles.emptyTitle}>История пуста</Text>
            <Text style={styles.emptyText}>Когда появятся первые закрытые смены, они будут отображаться здесь.</Text>
          </View>
        ) : (
          reports.map((report) => {
            const expanded = expandedId === report.id;
            const paid = report.salaryPaid === true;
            const diffLabel =
              report.difference > 0
                ? `Пересдача +${formatNum(report.difference)} ₽`
                : report.difference < 0
                  ? `Недосдача ${formatNum(report.difference)} ₽`
                  : 'Баланс сошелся';

            return (
              <TouchableOpacity
                key={report.id}
                style={styles.reportCard}
                activeOpacity={0.9}
                onPress={() => setExpandedId(expanded ? null : report.id)}
              >
                <View style={[styles.reportHeader, layout.isDesktop && styles.reportHeaderDesktop]}>
                  <View style={styles.headerMain}>
                    <Text style={styles.reportDate}>{formatDate(report.date)}</Text>
                    <Text style={styles.reportWorker}>{report.workerName || 'Без сотрудника'}</Text>
                    <Text style={[styles.reportStatus, report.difference >= 0 ? styles.statusPositive : styles.statusNegative]}>
                      {diffLabel}
                    </Text>
                    {paid ? <Text style={styles.paidBadge}>Зарплата выплачена</Text> : null}
                  </View>
                  <View style={styles.headerMeta}>
                    <Text style={styles.reportFact}>{formatNum(report.factTotal)} ₽</Text>
                    <Text style={styles.expandHint}>{expanded ? 'Скрыть детали' : 'Показать детали'}</Text>
                  </View>
                </View>

                {expanded ? (
                  <View style={styles.detailsBlock}>
                    <Text style={styles.detailText}>
                      Дэш: {formatNum(report.dashTotal)} ₽ (наличные {formatNum(report.dashCash)}, безнал {formatNum(report.dashCashless)})
                    </Text>
                    <Text style={styles.detailText}>
                      Факт: {formatNum(report.factTotal)} ₽ (наличные {formatNum(report.factCash)}, безнал {formatNum(report.factCashless)})
                    </Text>
                    <Text style={styles.detailText}>Процент: {formatNum(report.twoPercent)} ₽</Text>
                    {report.transfers ? <Text style={styles.detailText}>Переводы: {formatNum(report.transfers)} ₽</Text> : null}
                    {report.cleanerAmount ? <Text style={styles.detailText}>Уборщица: {formatNum(report.cleanerAmount)} ₽</Text> : null}

                    {report.goodsTaken?.length ? (
                      <View style={styles.detailGroup}>
                        <Text style={styles.groupTitle}>Товары</Text>
                        {report.goodsTaken.map((item, index) => (
                          <Text key={`${item.name}-${index}`} style={styles.groupText}>
                            {item.workerName ? `${item.workerName}: ` : ''}
                            {item.name} x{item.quantity} = {formatNum(item.quantity * item.price)} ₽
                          </Text>
                        ))}
                      </View>
                    ) : null}

                    {report.cashTakenItems?.length ? (
                      <View style={styles.detailGroup}>
                        <Text style={styles.groupTitle}>Деньги из кассы</Text>
                        {report.cashTakenItems.map((item, index) => (
                          <Text key={`${item.workerName}-${index}`} style={styles.groupText}>
                            {item.workerName ? `${item.workerName}: ` : ''}
                            {formatNum(item.amount)} ₽
                          </Text>
                        ))}
                      </View>
                    ) : null}

                    {report.expenses?.length ? (
                      <View style={styles.detailGroup}>
                        <Text style={styles.groupTitle}>Прочие расходы</Text>
                        {report.expenses.map((item, index) => (
                          <Text key={`${item.name}-${index}`} style={styles.groupText}>
                            {item.name}: {item.description}
                          </Text>
                        ))}
                      </View>
                    ) : null}

                    {report.fine ? (
                      <Text style={[styles.detailText, styles.fineText]}>
                        Штраф: {formatNum(report.fine.amount)} ₽, причина: {report.fine.reason}
                      </Text>
                    ) : null}

                    <View style={[styles.actionsRow, layout.isDesktop && styles.actionsRowDesktop]}>
                      <TouchableOpacity style={styles.secondaryAction} onPress={() => copyReport(report)}>
                        <Text style={styles.secondaryActionText}>Копировать</Text>
                      </TouchableOpacity>
                      {canEdit(report) ? (
                        <TouchableOpacity
                          style={styles.secondaryAction}
                          onPress={() => navigation.navigate('EditReport', { reportId: report.id })}
                        >
                          <Text style={styles.secondaryActionText}>Редактировать</Text>
                        </TouchableOpacity>
                      ) : null}
                      {canDelete(report) ? (
                        <TouchableOpacity style={styles.dangerAction} onPress={() => handleDelete(report)}>
                          <Text style={styles.dangerActionText}>Удалить</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })
        )}
      </SurfaceCard>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  primaryAction: {
    backgroundColor: COLORS.accent,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryActionText: {
    color: COLORS.background,
    fontSize: 13,
    fontWeight: '800',
  },
  topMetrics: {
    gap: 14,
    marginBottom: 18,
  },
  topMetricsDesktop: {
    flexDirection: 'row',
  },
  metricCard: {
    flex: 1,
  },
  metricLabel: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginBottom: 8,
  },
  metricValue: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: '800',
  },
  listCard: {
    gap: 16,
  },
  emptyBlock: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 18,
    padding: 20,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  reportCard: {
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceMuted,
    padding: 16,
  },
  reportHeader: {
    gap: 14,
  },
  reportHeaderDesktop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerMain: {
    flex: 1,
    gap: 6,
  },
  headerMeta: {
    alignItems: 'flex-start',
    gap: 8,
  },
  reportDate: {
    color: COLORS.textSoft,
    fontSize: 13,
    fontWeight: '600',
  },
  reportWorker: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '700',
  },
  reportStatus: {
    fontSize: 14,
    fontWeight: '700',
  },
  statusPositive: {
    color: COLORS.accent,
  },
  statusNegative: {
    color: COLORS.danger,
  },
  paidBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(123, 211, 176, 0.12)',
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginTop: 4,
  },
  reportFact: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '800',
  },
  expandHint: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
  detailsBlock: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSoft,
    gap: 10,
  },
  detailText: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
  detailGroup: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  groupTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  groupText: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  fineText: {
    color: COLORS.danger,
  },
  actionsRow: {
    gap: 10,
    marginTop: 6,
  },
  actionsRowDesktop: {
    flexDirection: 'row',
  },
  secondaryAction: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: COLORS.surfaceStrong,
  },
  secondaryActionText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  dangerAction: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 127, 150, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 127, 150, 0.28)',
  },
  dangerActionText: {
    color: COLORS.danger,
    fontSize: 14,
    fontWeight: '700',
  },
});
