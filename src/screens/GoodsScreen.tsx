import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { GoodItem, GoodDifference } from '../types';
import { getGoodsData, GoodData } from '../utils/smartshell';
import { saveGoodsDraft, getGoodsDraft } from '../utils/storage';
import { useAuth } from '../utils/AuthContext';

const COLORS = {
  bg: '#1a1d23', card: '#21242b', border: '#2a2d35', text: '#e0e0e0',
  textDim: '#8b8d94', green: '#4caf93', red: '#e0556a', inputBg: '#282c34',
};

export default function GoodsScreen() {
  const { isLoggedIn } = useAuth();
  const [goods, setGoods] = useState<GoodItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [differences, setDifferences] = useState<GoodDifference[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (isLoggedIn) {
        setLoading(true);
        fetchGoods().finally(() => setLoading(false));
      }
    }, [isLoggedIn])
  );

  const fetchGoods = async () => {
    try {
      const data = await getGoodsData();
      const saved = await getGoodsDraft();
      const items = data.map((d: GoodData) => {
        const sv = saved?.find((s: any) => s.id === String(d.id));
        return { id: String(d.id), name: d.name, shellQuantity: d.quantity, factQuantity: sv?.factQuantity || '' };
      });
      setGoods(items);
      setLoaded(true);
      setDifferences([]);
    } catch (e) {}
  };

  useEffect(() => { if (goods.length > 0) saveGoodsDraft(goods); }, [goods]);

  const updateFact = (id: string, v: string) => setGoods(prev => prev.map(g => g.id === id ? { ...g, factQuantity: v } : g));

  const calcDiff = () => {
    const diff: GoodDifference[] = [];
    goods.forEach(g => { const f = parseInt(g.factQuantity) || 0; const d = f - g.shellQuantity; if (d !== 0) diff.push({ name: g.name, difference: d }); });
    setDifferences(diff);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.green} />
        <Text style={styles.loadingText}>Загрузка товаров...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Инвентаризация товаров</Text>
        <TouchableOpacity style={styles.loadBtn} onPress={fetchGoods} disabled={loading}>
          <Text style={styles.loadBtnText}>{loaded ? 'Обновить' : 'Загрузить'}</Text>
        </TouchableOpacity>
      </View>
      {loaded && goods.length > 0 && (
        <>
          <View style={styles.tableHeader}><Text style={[styles.thText, styles.thName]}>Товар</Text><Text style={[styles.thText, styles.thShell]}>Shell</Text><Text style={[styles.thText, styles.thFact]}>Факт</Text></View>
          {goods.map(item => (
            <View key={item.id} style={styles.tableRow}>
              <Text style={[styles.tdText, styles.tdName]} numberOfLines={2}>{item.name}</Text>
              <Text style={[styles.tdText, styles.tdShell]}>{item.shellQuantity}</Text>
              <TextInput style={styles.tdInput} keyboardType="numeric" placeholder="0" placeholderTextColor={COLORS.textDim} value={item.factQuantity} onChangeText={v => updateFact(item.id, v)} />
            </View>
          ))}
          <TouchableOpacity style={styles.checkBtn} onPress={calcDiff}><Text style={styles.checkBtnText}>Проверить расхождения</Text></TouchableOpacity>
        </>
      )}
      {differences.length > 0 && (
        <View style={styles.diffCard}>
          <Text style={styles.diffTitle}>Различие по товарам</Text><View style={styles.diffDivider} />
          {differences.map((d, i) => (
            <View key={i} style={styles.diffRow}><Text style={styles.diffName}>{d.name}</Text><Text style={[styles.diffValue, { color: d.difference > 0 ? COLORS.green : COLORS.red }]}>{d.difference > 0 ? '+' : ''}{d.difference}</Text></View>
          ))}
        </View>
      )}
      {loaded && goods.length === 0 && !loading && (
        <View style={styles.emptyCard}><Text style={styles.emptyText}>Нет данных о товарах</Text><Text style={styles.emptySubText}>Возможно, смена не начата или нет продаж</Text></View>
      )}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

import { useEffect } from 'react';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 16 },
  center: { flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: COLORS.textDim, fontSize: 14, marginTop: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  headerTitle: { color: COLORS.text, fontSize: 18, fontWeight: '700' },
  loadBtn: { backgroundColor: COLORS.green, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  loadBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  tableHeader: { flexDirection: 'row', backgroundColor: COLORS.card, borderRadius: 8, padding: 12, marginBottom: 2, borderWidth: 1, borderColor: COLORS.border },
  thText: { color: COLORS.textDim, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  thName: { flex: 3 }, thShell: { flex: 1, textAlign: 'center' }, thFact: { flex: 1, textAlign: 'center' },
  tableRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 8, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border },
  tdText: { color: COLORS.text, fontSize: 14 }, tdName: { flex: 3 }, tdShell: { flex: 1, textAlign: 'center' },
  tdInput: { flex: 1, backgroundColor: COLORS.inputBg, borderRadius: 6, padding: 8, color: COLORS.text, fontSize: 14, textAlign: 'center', borderWidth: 1, borderColor: COLORS.border },
  checkBtn: { backgroundColor: COLORS.green, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 12 },
  checkBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  diffCard: { backgroundColor: COLORS.card, borderRadius: 12, padding: 16, marginTop: 16, borderWidth: 1, borderColor: COLORS.border },
  diffTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700', marginBottom: 8 },
  diffDivider: { height: 1, backgroundColor: COLORS.border, marginBottom: 12 },
  diffRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  diffName: { color: COLORS.text, fontSize: 14, flex: 2 },
  diffValue: { fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'right' },
  emptyCard: { backgroundColor: COLORS.card, borderRadius: 12, padding: 30, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  emptyText: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
  emptySubText: { color: COLORS.textDim, fontSize: 13, marginTop: 6, textAlign: 'center' },
});