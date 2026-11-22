import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getHistory } from '../utils/storage';
import { SavedReport } from '../types';
import { COLORS } from '../theme';

const formatNum = (value: number) => value.toLocaleString('ru-RU');

function MenuGlyph() {
  return (
    <View style={styles.menuGlyph} accessible={false}>
      <View style={styles.menuLine} />
      <View style={styles.menuLine} />
      <View style={styles.menuLine} />
    </View>
  );
}

function DataRow({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.dataRow}>
      <Text style={styles.dataLabel}>{label}</Text>
      <Text style={[styles.dataValue, accent && styles.accentValue]}>{value}</Text>
    </View>
  );
}

export default function DashboardScreen({ navigation }: { navigation: any }) {
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const loadData = async () => {
        setLoading(true);
        const data = await getHistory();
        if (active) {
          setReports(data);
          setLoading(false);
        }
      };

      loadData();
      return () => {
        active = false;
      };
    }, []),
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.green} />
        <Text style={styles.loadingText}>ЗАГРУЗКА ДАННЫХ</Text>
      </View>
    );
  }

  const totalCash = reports.reduce((sum, report) => sum + report.factCash, 0);
  const totalCashless = reports.reduce((sum, report) => sum + report.factCashless, 0);
  const totalCleaner = reports.reduce((sum, report) => sum + (report.cleanerAmount || 0), 0);
  const totalRevenue = totalCash + totalCashless + totalCleaner;

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const last7Days = reports.filter((report) => new Date(report.date) >= weekAgo);
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
    .sort(([, first], [, second]) => second - first)
    .slice(0, 5);

  const workerShifts: Record<string, number> = {};
  reports.forEach((report) => {
    const worker = report.workerName || 'Без имени';
    workerShifts[worker] = (workerShifts[worker] || 0) + 1;
  });
  const workers = Object.entries(workerShifts).sort(([, first], [, second]) => second - first);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.topbar, isDesktop && styles.topbarDesktop]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Открыть меню"
          onPress={() => navigation.openDrawer()}
          style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}
        >
          <MenuGlyph />
        </Pressable>

        <View style={styles.brand}>
          <View style={styles.brandMark}>
            <Text style={styles.brandMarkText}>S</Text>
          </View>
          <View>
            <Text style={styles.brandTitle}>SHIFT REPORT</Text>
            <Text style={styles.brandSubtitle}>РАБОЧАЯ СИСТЕМА</Text>
          </View>
        </View>

        <View style={styles.onlineStatus}>
          <View style={styles.onlineDot} />
          <Text style={styles.onlineText}>LIVE</Text>
        </View>
      </View>

      <View style={[styles.hero, isDesktop && styles.heroDesktop]}>
        <Text style={styles.eyebrow}>КОНТРОЛЬ СМЕН</Text>
        <Text style={[styles.title, isDesktop && styles.titleDesktop]}>Dashboard</Text>
        <Text style={[styles.heroDescription, isDesktop && styles.heroDescriptionDesktop]}>Сводка по выручке, сменам и товарам</Text>
      </View>

      <View style={[styles.primaryPanel, isDesktop && styles.primaryPanelDesktop]}>
        <View style={styles.panelHeader}>
          <View>
            <Text style={styles.eyebrow}>ОБЩАЯ ВЫРУЧКА</Text>
            <Text style={styles.panelCaption}>за весь период</Text>
          </View>
          <Text style={styles.panelIndex}>01</Text>
        </View>

        <View style={styles.totalLine}>
          <Text style={styles.totalValue}>{formatNum(totalRevenue)}</Text>
          <Text style={styles.currency}>₽</Text>
        </View>

        <View style={styles.metricStrip}>
          <View style={styles.metricCell}>
            <Text style={styles.metricLabel}>НАЛИЧНЫЕ</Text>
            <Text style={styles.metricValue}>{formatNum(totalCash)} ₽</Text>
          </View>
          <View style={styles.metricCell}>
            <Text style={styles.metricLabel}>БЕЗНАЛ</Text>
            <Text style={styles.metricValue}>{formatNum(totalCashless)} ₽</Text>
          </View>
          <View style={[styles.metricCell, styles.metricCellLast]}>
            <Text style={styles.metricLabel}>УБОРКА</Text>
            <Text style={styles.metricValue}>{formatNum(totalCleaner)} ₽</Text>
          </View>
        </View>
      </View>

      <View style={[styles.sectionBar, isDesktop && styles.sectionBarDesktop]}>
        <View>
          <Text style={styles.eyebrow}>АКТИВНОСТЬ</Text>
          <Text style={[styles.sectionTitle, isDesktop && styles.sectionTitleDesktop]}>Последние 7 дней</Text>
        </View>
        <Text style={[styles.sectionMeta, isDesktop && styles.sectionMetaDesktop]}>{last7Days.length} смен</Text>
      </View>

      <View style={[styles.panel, isDesktop && styles.panelDesktop]}>
        <View style={styles.weekTotalRow}>
          <Text style={styles.weekTotal}>{formatNum(weekRevenue)} ₽</Text>
          <Text style={styles.weekTotalLabel}>ВЫРУЧКА</Text>
        </View>
        <DataRow label="Наличные" value={`${formatNum(weekCash)} ₽`} />
        <DataRow label="Безналичные" value={`${formatNum(weekCashless)} ₽`} />
        <DataRow label="Смены закрыты" value={String(last7Days.length)} accent />
      </View>

      <View style={[styles.sectionBar, isDesktop && styles.sectionBarDesktop]}>
        <View>
          <Text style={styles.eyebrow}>ТОВАРЫ</Text>
          <Text style={[styles.sectionTitle, isDesktop && styles.sectionTitleDesktop]}>Топ по ЗП</Text>
        </View>
        <Text style={[styles.sectionMeta, isDesktop && styles.sectionMetaDesktop]}>ТОП 05</Text>
      </View>

      <View style={[styles.panel, isDesktop && styles.panelDesktop]}>
        {topGoods.length > 0 ? (
          topGoods.map(([name, quantity], index) => (
            <View key={name} style={styles.listRow}>
              <Text style={styles.listIndex}>{String(index + 1).padStart(2, '0')}</Text>
              <Text style={styles.listName} numberOfLines={1}>{name}</Text>
              <Text style={styles.listValue}>{quantity} шт</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>Товары пока не списывались</Text>
        )}
      </View>

      <View style={[styles.sectionBar, isDesktop && styles.sectionBarDesktop]}>
        <View>
          <Text style={styles.eyebrow}>КОМАНДА</Text>
          <Text style={[styles.sectionTitle, isDesktop && styles.sectionTitleDesktop]}>Смены сотрудников</Text>
        </View>
        <Text style={[styles.sectionMeta, isDesktop && styles.sectionMetaDesktop]}>{workers.length} чел.</Text>
      </View>

      <View style={[styles.panel, isDesktop && styles.panelDesktop]}>
        {workers.length > 0 ? (
          workers.map(([name, count], index) => (
            <View key={name} style={styles.listRow}>
              <Text style={styles.listIndex}>{String(index + 1).padStart(2, '0')}</Text>
              <Text style={styles.listName} numberOfLines={1}>{name}</Text>
              <Text style={styles.listValue}>{count} смен</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>Смены еще не закрыты</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { width: '100%', maxWidth: 1600, alignSelf: 'center', paddingHorizontal: 14, paddingBottom: 42 },
  contentDesktop: { paddingHorizontal: 36, paddingBottom: 64 },
  center: { flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 14, color: COLORS.textDim, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  topbar: { minHeight: 66, borderBottomWidth: 1, borderBottomColor: COLORS.border, flexDirection: 'row', alignItems: 'center' },
  topbarDesktop: { minHeight: 78 },
  menuButton: { width: 42, height: 42, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  menuGlyph: { width: 17, height: 14, justifyContent: 'space-between' },
  menuLine: { height: 1, width: 17, backgroundColor: COLORS.green },
  brand: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  brandMark: { width: 30, height: 30, backgroundColor: COLORS.green, alignItems: 'center', justifyContent: 'center', marginRight: 9 },
  brandMarkText: { color: COLORS.bg, fontSize: 20, fontWeight: '800' },
  brandTitle: { color: COLORS.text, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  brandSubtitle: { color: COLORS.textDim, fontSize: 9, letterSpacing: 1, marginTop: 3 },
  onlineStatus: { flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
  onlineDot: { width: 6, height: 6, borderRadius: 0, backgroundColor: COLORS.green, marginRight: 6 },
  onlineText: { color: COLORS.green, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  hero: { paddingTop: 28, paddingBottom: 24 },
  heroDesktop: { paddingTop: 42, paddingBottom: 34 },
  eyebrow: { color: COLORS.green, fontSize: 10, fontWeight: '800', letterSpacing: 1.3 },
  title: { color: COLORS.text, fontSize: 38, fontWeight: '600', letterSpacing: -1, lineHeight: 42, marginTop: 7 },
  titleDesktop: { fontSize: 50, lineHeight: 56 },
  heroDescription: { color: COLORS.textDim, fontSize: 13, marginTop: 8 },
  heroDescriptionDesktop: { fontSize: 15, marginTop: 12 },
  primaryPanel: { borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card, padding: 16 },
  primaryPanelDesktop: { padding: 24 },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  panelCaption: { color: COLORS.textDim, fontSize: 10, marginTop: 5 },
  panelIndex: { color: COLORS.borderStrong, fontSize: 20, fontWeight: '800' },
  totalLine: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 22, marginBottom: 20 },
  totalValue: { color: COLORS.text, fontSize: 48, fontWeight: '600', letterSpacing: -1, lineHeight: 53 },
  currency: { color: COLORS.green, fontSize: 22, fontWeight: '700', marginLeft: 8, marginBottom: 7 },
  metricStrip: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 13 },
  metricCell: { flex: 1, borderRightWidth: 1, borderRightColor: COLORS.border, paddingRight: 10, marginRight: 10 },
  metricCellLast: { borderRightWidth: 0, marginRight: 0, paddingRight: 0 },
  metricLabel: { color: COLORS.textDim, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  metricValue: { color: COLORS.text, fontSize: 14, fontWeight: '700', marginTop: 8 },
  sectionBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 30, marginBottom: 12 },
  sectionBarDesktop: { marginTop: 42, marginBottom: 16 },
  sectionTitle: { color: COLORS.text, fontSize: 22, fontWeight: '700', letterSpacing: -0.4, marginTop: 6 },
  sectionTitleDesktop: { fontSize: 29, marginTop: 8 },
  sectionMeta: { color: COLORS.textDim, fontSize: 10, fontWeight: '700', letterSpacing: 0.8, paddingBottom: 3 },
  sectionMetaDesktop: { fontSize: 12 },
  panel: { borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card, paddingHorizontal: 16, paddingVertical: 8 },
  panelDesktop: { paddingHorizontal: 24, paddingVertical: 12 },
  weekTotalRow: { paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: COLORS.border, marginBottom: 2 },
  weekTotal: { color: COLORS.green, fontSize: 34, fontWeight: '600', letterSpacing: -0.5 },
  weekTotalLabel: { color: COLORS.textDim, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginTop: 5 },
  dataRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  dataLabel: { color: COLORS.textDim, fontSize: 14 },
  dataValue: { color: COLORS.text, fontSize: 15, fontWeight: '700' },
  accentValue: { color: COLORS.green },
  listRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  listIndex: { color: COLORS.green, fontSize: 11, fontWeight: '800', width: 34 },
  listName: { color: COLORS.text, flex: 1, fontSize: 15, paddingRight: 10 },
  listValue: { color: COLORS.textDim, fontSize: 13, fontWeight: '700' },
  emptyText: { color: COLORS.textDim, fontSize: 14, paddingVertical: 20 },
  pressed: { opacity: 0.65 },
});
