import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { GoodDifference, GoodItem } from '../types';
import { MetricPill, ScreenHeader, ScreenLayout, SectionTitle, SurfaceCard, sharedInputStyles, useResponsiveLayout } from '../ui/layout';
import { COLORS } from '../ui/theme';
import { getGoodsDraft, saveGoodsDraft } from '../utils/storage';
import { getGoodsData, GoodData } from '../utils/smartshell';
import { useAuth } from '../utils/AuthContext';

export default function GoodsScreen() {
  const layout = useResponsiveLayout();
  const { isLoggedIn } = useAuth();
  const [goods, setGoods] = useState<GoodItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [differences, setDifferences] = useState<GoodDifference[]>([]);
  const [checked, setChecked] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (isLoggedIn) {
        setLoading(true);
        fetchGoods().finally(() => setLoading(false));
      }
    }, [isLoggedIn])
  );

  useEffect(() => {
    if (goods.length > 0) {
      saveGoodsDraft(goods);
    }
  }, [goods]);

  const fetchGoods = async () => {
    try {
      const data = await getGoodsData();
      const saved = await getGoodsDraft();
      const items = data.map((item: GoodData) => {
        const savedItem = saved?.find((entry: any) => entry.id === String(item.id));
        return {
          id: String(item.id),
          name: item.name,
          shellQuantity: item.quantity,
          factQuantity: savedItem?.factQuantity || '',
        };
      });
      setGoods(items);
      setLoaded(true);
      setDifferences([]);
      setChecked(false);
    } catch (error) {
      setGoods([]);
      setLoaded(true);
      setChecked(false);
    }
  };

  const updateFact = (id: string, value: string) => {
    setGoods((current) => current.map((item) => (item.id === id ? { ...item, factQuantity: value } : item)));
    setChecked(false);
  };

  const calcDiff = () => {
    const nextDifferences: GoodDifference[] = [];
    goods.forEach((item) => {
      const fact = parseInt(item.factQuantity, 10) || 0;
      const difference = fact - item.shellQuantity;
      if (difference !== 0) {
        nextDifferences.push({ name: item.name, difference });
      }
    });
    setDifferences(nextDifferences);
    setChecked(true);
  };

  const totals = useMemo(() => {
    return goods.reduce(
      (accumulator, item) => {
        accumulator.shell += item.shellQuantity;
        accumulator.fact += parseInt(item.factQuantity, 10) || 0;
        return accumulator;
      },
      { shell: 0, fact: 0 }
    );
  }, [goods]);

  if (loading) {
    return (
      <ScreenLayout scroll={false}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.stateText}>Получаем товары из SmartShell...</Text>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout>
      <ScreenHeader
        title="Инвентаризация"
        subtitle="Сравните остатки из SmartShell с фактическим количеством и сразу увидите расхождения."
        right={
          <TouchableOpacity style={styles.primaryAction} onPress={fetchGoods} disabled={loading}>
            <Text style={styles.primaryActionText}>{loaded ? 'Обновить данные' : 'Загрузить товары'}</Text>
          </TouchableOpacity>
        }
      />

      <View style={[styles.summaryGrid, layout.isDesktop && styles.summaryGridDesktop]}>
        <MetricPill label="Позиций" value={String(goods.length)} accent />
        <MetricPill label="Shell" value={String(totals.shell)} />
        <MetricPill label="Факт" value={String(totals.fact)} />
        <MetricPill label="Расхождения" value={String(differences.length)} />
      </View>

      <SurfaceCard style={styles.tableCard}>
        <SectionTitle
          eyebrow="Склад"
          title="Текущий список товаров"
          subtitle="Введите фактические значения, затем проверьте расхождения. Результат появится под таблицей."
        />
        {loaded && goods.length > 0 ? (
          <>
            <View style={styles.tableHeader}>
              <Text style={[styles.headerCell, styles.nameCell]}>Товар</Text>
              <Text style={[styles.headerCell, styles.qtyCell]}>Shell</Text>
              <Text style={[styles.headerCell, styles.qtyCell]}>Факт</Text>
            </View>
            {goods.map((item) => (
              <View key={item.id} style={styles.tableRow}>
                <Text style={[styles.bodyCell, styles.nameCell]} numberOfLines={2}>
                  {item.name}
                </Text>
                <Text style={[styles.bodyCell, styles.qtyCell, styles.shellCell]}>{item.shellQuantity}</Text>
                <TextInput
                  style={[sharedInputStyles.input, styles.factInput]}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={COLORS.textSoft}
                  value={item.factQuantity}
                  onChangeText={(value) => updateFact(item.id, value)}
                />
              </View>
            ))}
            <TouchableOpacity style={styles.secondaryAction} onPress={calcDiff}>
              <Text style={styles.secondaryActionText}>Проверить расхождения</Text>
            </TouchableOpacity>
          </>
        ) : null}

        {loaded && goods.length === 0 ? (
          <View style={styles.emptyBlock}>
            <Text style={styles.emptyTitle}>Пустой список товаров</Text>
            <Text style={styles.emptyText}>Возможно, смена еще не начата или в SmartShell нет остатков для выгрузки.</Text>
          </View>
        ) : null}
      </SurfaceCard>

      {checked ? (
        <SurfaceCard style={styles.resultCard}>
          <SectionTitle
            eyebrow="Контроль"
            title={differences.length > 0 ? 'Обнаруженные расхождения' : 'Расхождений нет'}
            subtitle="Разница считается как факт минус количество из системы."
          />
          {differences.length > 0 ? (
            differences.map((item) => (
              <View key={`${item.name}-${item.difference}`} style={styles.diffRow}>
                <Text style={styles.diffName}>{item.name}</Text>
                <Text style={[styles.diffValue, item.difference > 0 ? styles.diffPositive : styles.diffNegative]}>
                  {item.difference > 0 ? '+' : ''}
                  {item.difference}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>Все введенные фактические значения совпадают с остатками Shell.</Text>
          )}
        </SurfaceCard>
      ) : null}
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
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 18,
  },
  summaryGridDesktop: {
    flexWrap: 'nowrap',
  },
  tableCard: {
    gap: 16,
  },
  resultCard: {
    marginTop: 18,
    gap: 16,
  },
  tableHeader: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },
  headerCell: {
    color: COLORS.textSoft,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  tableRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },
  nameCell: {
    flex: 1,
  },
  qtyCell: {
    width: 90,
    textAlign: 'center',
  },
  bodyCell: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 20,
  },
  shellCell: {
    color: COLORS.textMuted,
  },
  factInput: {
    width: 90,
    textAlign: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  secondaryAction: {
    marginTop: 18,
    backgroundColor: COLORS.surfaceStrong,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryActionText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  diffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },
  diffName: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 20,
  },
  diffValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  diffPositive: {
    color: COLORS.accent,
  },
  diffNegative: {
    color: COLORS.danger,
  },
  emptyBlock: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 18,
    padding: 20,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
});
