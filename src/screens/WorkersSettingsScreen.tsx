import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Switch, TextInput,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { getWorkersWithSettings, updateWorkerSettings } from '../utils/storage';
import { COLORS } from '../theme';
import Animated from 'react-native-reanimated';
import { useScreenMotion } from '../utils/screenMotion';

export default function WorkersSettingsScreen() {
  const screenMotionStyle = useScreenMotion();
  const [workers, setWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWorkers();
  }, []);

  const loadWorkers = async () => {
    setLoading(true);
    const data = await getWorkersWithSettings();
    setWorkers(data);
    setLoading(false);
  };

  const updateBaseSalary = (id: string, value: string) => {
    setWorkers(prev => prev.map(w => w.id === parseInt(id) ? { ...w, base_salary: value } : w));
  };

  const togglePercent = (id: string) => {
    setWorkers(prev => prev.map(w => w.id === parseInt(id) ? { ...w, calculate_percent: !w.calculate_percent } : w));
  };

  const toggleIncludeInSalary = (id: string) => {
    setWorkers(prev => prev.map(w => w.id === parseInt(id) ? { ...w, include_in_salary: w.include_in_salary === false ? true : false } : w));
  };

  const saveWorker = async (worker: any) => {
    const baseSalary = parseFloat(worker.base_salary) || 1400;
    await updateWorkerSettings(
      String(worker.id),
      baseSalary,
      worker.calculate_percent !== false,
      worker.include_in_salary !== false
    );
    Alert.alert('Сохранено', `Настройки для ${worker.first_name} ${worker.last_name} обновлены`);
  };

  if (loading) {
    return (
      <Animated.View style={[styles.center, screenMotionStyle]}>
        <ActivityIndicator size="large" color={COLORS.green} />
      </Animated.View>
    );
  }

  return (
    <Animated.ScrollView style={[styles.container, screenMotionStyle]}>
      <Text style={styles.title}>Настройки сотрудников</Text>
      {workers.map((worker) => (
        <View key={worker.id} style={styles.card}>
          <Text style={styles.workerName}>
            {[worker.first_name, worker.last_name].filter(Boolean).join(' ') || worker.nickname || `ID: ${worker.id}`}
          </Text>
          <Text style={styles.role}>Роль: {worker.role || '—'}</Text>

          <View style={styles.row}>
            <Text style={styles.label}>Базовая ставка (₽):</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={String(worker.base_salary || 1400)}
              onChangeText={(v) => updateBaseSalary(String(worker.id), v)}
            />
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Начислять проценты:</Text>
            <Switch
              value={worker.calculate_percent !== false}
              onValueChange={() => togglePercent(String(worker.id))}
              trackColor={{ false: COLORS.border, true: COLORS.green }}
              thumbColor={worker.calculate_percent !== false ? '#fff' : '#888'}
            />
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Учитывать в зарплате:</Text>
            <Switch
              value={worker.include_in_salary !== false}
              onValueChange={() => toggleIncludeInSalary(String(worker.id))}
              trackColor={{ false: COLORS.border, true: COLORS.green }}
              thumbColor={worker.include_in_salary !== false ? '#fff' : '#888'}
            />
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={() => saveWorker(worker)}>
            <Text style={styles.saveBtnText}>Сохранить</Text>
          </TouchableOpacity>
        </View>
      ))}
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 16 },
  center: { flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center' },
  title: { color: COLORS.text, fontSize: 22, fontWeight: '700', marginBottom: 16 },
  card: { backgroundColor: COLORS.card, borderRadius: 0, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  workerName: { color: COLORS.text, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  role: { color: COLORS.textDim, fontSize: 13, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  label: { color: COLORS.textDim, fontSize: 14, flex: 1 },
  input: { backgroundColor: COLORS.inputBg, borderRadius: 0, padding: 10, color: COLORS.text, fontSize: 16, borderWidth: 1, borderColor: COLORS.border, width: 120, textAlign: 'center' },
  saveBtn: { backgroundColor: COLORS.green, borderRadius: 0, padding: 10, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: COLORS.bg, fontSize: 14, fontWeight: '800' },
});
