import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import PickerModal from '../components/PickerModal';
import {
  ScreenHeader,
  ScreenLayout,
  SectionTitle,
  SurfaceCard,
  sharedInputStyles,
  sharedTextStyles,
  useResponsiveLayout,
} from '../ui/layout';
import { COLORS } from '../ui/theme';
import { SavedReport } from '../types';
import { calculateShift } from '../utils/calculations';
import { getGoodsWithPrices } from '../utils/smartshell';
import { getReportById, getWorkersFromSupabase, updateReport } from '../utils/storage';

type GoodsDraftRow = {
  workerName: string;
  goodsName: string;
  quantity: string;
  price: string;
};

type CashDraftRow = {
  workerName: string;
  amount: string;
};

type GoodsOption = {
  id: string;
  title: string;
  cost: number;
};

const formatNum = (value: number) => value.toLocaleString('ru-RU');
const emptyGoodsRow = (): GoodsDraftRow => ({ workerName: '', goodsName: '', quantity: '', price: '' });
const emptyCashRow = (): CashDraftRow => ({ workerName: '', amount: '' });

export default function EditReportScreen() {
  const layout = useResponsiveLayout();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const reportId = route.params?.reportId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [report, setReport] = useState<SavedReport | null>(null);
  const [factCash, setFactCash] = useState('');
  const [factCashless, setFactCashless] = useState('');
  const [cleanerAmount, setCleanerAmount] = useState('');
  const [transfers, setTransfers] = useState('');
  const [goodsTaken, setGoodsTaken] = useState<GoodsDraftRow[]>([emptyGoodsRow()]);
  const [cashTaken, setCashTaken] = useState<CashDraftRow[]>([emptyCashRow()]);
  const [workers, setWorkers] = useState<{ id: string; name: string }[]>([]);
  const [goodsList, setGoodsList] = useState<GoodsOption[]>([]);
  const [showWorkerPicker, setShowWorkerPicker] = useState(false);
  const [showGoodsPicker, setShowGoodsPicker] = useState(false);
  const [showMultiGoodsPicker, setShowMultiGoodsPicker] = useState(false);
  const [currentGoodsIndex, setCurrentGoodsIndex] = useState<number | null>(null);
  const [currentCashIndex, setCurrentCashIndex] = useState<number | null>(null);
  const [pickerTarget, setPickerTarget] = useState<'goodsWorker' | 'cashWorker' | null>(null);
  const [multiGoodsSourceIndex, setMultiGoodsSourceIndex] = useState<number | null>(null);
  const [selectedGoodsIds, setSelectedGoodsIds] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [reportData, workersData, goodsData] = await Promise.all([
      getReportById(reportId),
      getWorkersFromSupabase(),
      getGoodsWithPrices(),
    ]);

    if (reportData) {
      setReport(reportData);
      setFactCash(String(reportData.factCash));
      setFactCashless(String(reportData.factCashless));
      setCleanerAmount(reportData.cleanerAmount ? String(reportData.cleanerAmount) : '');
      setTransfers(reportData.transfers ? String(reportData.transfers) : '');
      setGoodsTaken(
        reportData.goodsTaken?.length
          ? reportData.goodsTaken.map((item) => ({
              workerName: item.workerName || '',
              goodsName: item.name || '',
              quantity: String(item.quantity || ''),
              price: String(item.price || ''),
            }))
          : [emptyGoodsRow()]
      );
      setCashTaken(
        reportData.cashTakenItems?.length
          ? reportData.cashTakenItems.map((item) => ({
              workerName: item.workerName || '',
              amount: String(item.amount || ''),
            }))
          : [emptyCashRow()]
      );
    }

    setWorkers(
      workersData.map((worker: any) => ({
        id: String(worker.id),
        name:
          [worker.first_name, worker.last_name].filter(Boolean).join(' ') ||
          worker.nickname ||
          String(worker.id),
      }))
    );
    setGoodsList(goodsData);
    setLoading(false);
  };

  const cashTakenTotal = useMemo(
    () => cashTaken.reduce((sum, item) => sum + (parseInt(item.amount, 10) || 0), 0),
    [cashTaken]
  );

  const calc = useMemo(() => {
    if (!report) {
      return null;
    }

    return calculateShift(
      {
        dashCash: String(report.dashCash),
        dashCashless: String(report.dashCashless),
        factCash,
        factCashless,
        transfers,
        expenses: [],
      },
      parseInt(cleanerAmount, 10) || 0,
      cashTakenTotal
    );
  }, [report, factCash, factCashless, transfers, cleanerAmount, cashTakenTotal]);

  const updateGoodsTaken = (index: number, field: keyof GoodsDraftRow, value: string) => {
    setGoodsTaken((prev) =>
      prev.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item))
    );
  };

  const removeGoodsTaken = (index: number) => {
    setGoodsTaken((prev) => {
      const next = prev.filter((_, itemIndex) => itemIndex !== index);
      return next.length ? next : [emptyGoodsRow()];
    });
  };

  const addGoodsTaken = () => setGoodsTaken((prev) => [...prev, emptyGoodsRow()]);

  const updateCashTaken = (index: number, field: keyof CashDraftRow, value: string) => {
    setCashTaken((prev) =>
      prev.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item))
    );
  };

  const removeCashTaken = (index: number) => {
    setCashTaken((prev) => {
      const next = prev.filter((_, itemIndex) => itemIndex !== index);
      return next.length ? next : [emptyCashRow()];
    });
  };

  const addCashTaken = () => setCashTaken((prev) => [...prev, emptyCashRow()]);

  const selectWorker = (item: { id: string; label: string }) => {
    if (pickerTarget === 'goodsWorker' && currentGoodsIndex !== null) {
      updateGoodsTaken(currentGoodsIndex, 'workerName', item.label);
    }

    if (pickerTarget === 'cashWorker' && currentCashIndex !== null) {
      updateCashTaken(currentCashIndex, 'workerName', item.label);
    }

    setShowWorkerPicker(false);
    setPickerTarget(null);
    setCurrentGoodsIndex(null);
    setCurrentCashIndex(null);
  };

  const selectGoodsItem = (item: { id: string; label: string; sublabel?: string }) => {
    if (currentGoodsIndex === null) return;

    const good = goodsList.find((entry) => entry.id === item.id);
    updateGoodsTaken(currentGoodsIndex, 'goodsName', item.label);
    if (good) {
      updateGoodsTaken(currentGoodsIndex, 'price', String(good.cost));
    }

    setShowGoodsPicker(false);
    setCurrentGoodsIndex(null);
  };

  const openMultiGoodsPicker = (index: number) => {
    const sourceWorker = goodsTaken[index]?.workerName?.trim();
    if (!sourceWorker) {
      Alert.alert('Выберите сотрудника', 'Сначала укажите сотрудника для строки товара.');
      return;
    }

    setMultiGoodsSourceIndex(index);
    setSelectedGoodsIds([]);
    setShowMultiGoodsPicker(true);
  };

  const toggleMultiGoods = (id: string) => {
    setSelectedGoodsIds((prev) =>
      prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id]
    );
  };

  const confirmMultiGoods = () => {
    if (multiGoodsSourceIndex === null) return;
    if (selectedGoodsIds.length === 0) {
      Alert.alert('Выберите товары', 'Отметьте один или несколько товаров для добавления.');
      return;
    }

    const sourceRow = goodsTaken[multiGoodsSourceIndex];
    const mappedRows = selectedGoodsIds
      .map((id) => goodsList.find((good) => good.id === id))
      .filter((good): good is GoodsOption => Boolean(good))
      .map((good) => ({
        workerName: sourceRow.workerName,
        goodsName: good.title,
        quantity: '1',
        price: String(good.cost),
      }));

    setGoodsTaken((prev) => {
      const next = [...prev];
      const sourceIsEmpty = !sourceRow.goodsName.trim() && !sourceRow.quantity.trim();
      if (sourceIsEmpty) {
        next.splice(multiGoodsSourceIndex, 1, ...mappedRows);
      } else {
        next.splice(multiGoodsSourceIndex + 1, 0, ...mappedRows);
      }
      return next;
    });

    setShowMultiGoodsPicker(false);
    setMultiGoodsSourceIndex(null);
    setSelectedGoodsIds([]);
  };

  const handleSave = async () => {
    if (!report || !calc) return;

    setSaving(true);

    try {
      await updateReport(reportId, {
        fact_cash: parseFloat(factCash) || 0,
        fact_cashless: parseFloat(factCashless) || 0,
        cleaner_amount: parseFloat(cleanerAmount) || 0,
        transfers: parseFloat(transfers) || 0,
        fact_total: calc.factTotal,
        two_percent: calc.twoPercent,
        difference: calc.difference,
        goods_taken: goodsTaken
          .filter((item) => item.workerName.trim() && item.goodsName.trim())
          .map((item) => ({
            workerName: item.workerName,
            name: item.goodsName,
            quantity: parseInt(item.quantity, 10) || 0,
            price: parseInt(item.price, 10) || 0,
          })),
        cash_taken_items: cashTaken
          .filter((item) => item.workerName.trim() && item.amount.trim())
          .map((item) => ({
            workerName: item.workerName,
            amount: parseInt(item.amount, 10) || 0,
          })),
      });

      Alert.alert('Сохранено', 'Отчет обновлен.');
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Ошибка', error?.message || 'Не удалось сохранить отчет.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ScreenLayout scroll={false}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.stateText}>Загружаем отчет...</Text>
        </View>
      </ScreenLayout>
    );
  }

  if (!report || !calc) {
    return (
      <ScreenLayout scroll={false}>
        <View style={styles.centerState}>
          <Text style={styles.errorText}>Отчет не найден.</Text>
        </View>
      </ScreenLayout>
    );
  }

  const diffLabel =
    calc.difference > 0
      ? `Пересдача +${formatNum(calc.difference)} ₽`
      : calc.difference < 0
        ? `Недосдача ${formatNum(calc.difference)} ₽`
        : 'Баланс сошелся';

  return (
    <ScreenLayout>
      <ScreenHeader
        title="Редактирование отчета"
        subtitle={`${report.workerName || 'Без сотрудника'} • ${new Date(report.date).toLocaleString('ru-RU')}`}
      />

      <View style={[styles.mainGrid, layout.isDesktop && styles.mainGridDesktop]}>
        <View style={styles.primaryColumn}>
          <SurfaceCard style={styles.sectionCard}>
            <SectionTitle eyebrow="Дэш" title="Исходные значения" subtitle="Этот блок только для чтения." />
            <View style={styles.twoCol}>
              <View style={styles.field}>
                <Text style={sharedTextStyles.label}>Наличные</Text>
                <Text style={styles.readonlyValue}>{formatNum(report.dashCash)} ₽</Text>
              </View>
              <View style={styles.field}>
                <Text style={sharedTextStyles.label}>Карта</Text>
                <Text style={styles.readonlyValue}>{formatNum(report.dashCashless)} ₽</Text>
              </View>
            </View>
            <Text style={styles.mutedLine}>Итого: {formatNum(report.dashTotal)} ₽</Text>
          </SurfaceCard>

          <SurfaceCard style={styles.sectionCard}>
            <SectionTitle eyebrow="Факт" title="Актуальные суммы" />
            <View style={styles.twoCol}>
              <View style={styles.field}>
                <Text style={sharedTextStyles.label}>Наличные</Text>
                <TextInput
                  style={sharedInputStyles.input}
                  keyboardType="numeric"
                  value={factCash}
                  onChangeText={setFactCash}
                  placeholder="0"
                  placeholderTextColor={COLORS.textSoft}
                />
              </View>
              <View style={styles.field}>
                <Text style={sharedTextStyles.label}>Карта</Text>
                <TextInput
                  style={sharedInputStyles.input}
                  keyboardType="numeric"
                  value={factCashless}
                  onChangeText={setFactCashless}
                  placeholder="0"
                  placeholderTextColor={COLORS.textSoft}
                />
              </View>
            </View>
            <View style={styles.twoCol}>
              <View style={styles.field}>
                <Text style={sharedTextStyles.label}>Переводы</Text>
                <TextInput
                  style={sharedInputStyles.input}
                  keyboardType="numeric"
                  value={transfers}
                  onChangeText={setTransfers}
                  placeholder="0"
                  placeholderTextColor={COLORS.textSoft}
                />
              </View>
              <View style={styles.field}>
                <Text style={sharedTextStyles.label}>Уборщица</Text>
                <TextInput
                  style={sharedInputStyles.input}
                  keyboardType="numeric"
                  value={cleanerAmount}
                  onChangeText={setCleanerAmount}
                  placeholder="0"
                  placeholderTextColor={COLORS.textSoft}
                />
              </View>
            </View>
          </SurfaceCard>

          <SurfaceCard style={styles.sectionCard}>
            <SectionTitle
              eyebrow="Товары"
              title="Товары под зарплату"
              subtitle="Здесь тот же сценарий, что и в новой сдаче смены."
            />
            {goodsTaken.map((item, index) => (
              <View key={`${item.workerName}-${item.goodsName}-${index}`} style={styles.goodsItem}>
                <View style={styles.goodsRow}>
                  <TouchableOpacity
                    style={styles.pickerField}
                    onPress={() => {
                      setPickerTarget('goodsWorker');
                      setCurrentGoodsIndex(index);
                      setShowWorkerPicker(true);
                    }}
                  >
                    <Text style={[styles.pickerText, !item.workerName && styles.placeholderText]}>
                      {item.workerName || 'Кто'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.pickerField}
                    onPress={() => {
                      setCurrentGoodsIndex(index);
                      setShowGoodsPicker(true);
                    }}
                  >
                    <Text style={[styles.pickerText, !item.goodsName && styles.placeholderText]}>
                      {item.goodsName || 'Товар'}
                    </Text>
                  </TouchableOpacity>
                  <TextInput
                    style={[sharedInputStyles.input, styles.quantityInput]}
                    keyboardType="numeric"
                    value={item.quantity}
                    onChangeText={(value) => updateGoodsTaken(index, 'quantity', value)}
                    placeholder="Кол"
                    placeholderTextColor={COLORS.textSoft}
                  />
                  <View style={styles.priceCell}>
                    <Text style={styles.priceText}>
                      {formatNum((parseInt(item.quantity, 10) || 1) * (parseInt(item.price, 10) || 0))} ₽
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.iconAction} onPress={() => removeGoodsTaken(index)}>
                    <Text style={styles.iconActionText}>×</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.batchGoodsButton} onPress={() => openMultiGoodsPicker(index)}>
                  <Text style={styles.batchGoodsText}>+ несколько товаров этому сотруднику</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.secondaryGhost} onPress={addGoodsTaken}>
              <Text style={styles.secondaryGhostText}>Добавить строку товара</Text>
            </TouchableOpacity>
          </SurfaceCard>

          <SurfaceCard style={styles.sectionCard}>
            <SectionTitle eyebrow="Касса" title="Деньги из кассы" />
            {cashTaken.map((item, index) => (
              <View key={`${item.workerName}-${index}`} style={styles.cashRow}>
                <TouchableOpacity
                  style={styles.pickerField}
                  onPress={() => {
                    setPickerTarget('cashWorker');
                    setCurrentCashIndex(index);
                    setShowWorkerPicker(true);
                  }}
                >
                  <Text style={[styles.pickerText, !item.workerName && styles.placeholderText]}>
                    {item.workerName || 'Кто'}
                  </Text>
                </TouchableOpacity>
                <TextInput
                  style={[sharedInputStyles.input, styles.cashAmountInput]}
                  keyboardType="numeric"
                  value={item.amount}
                  onChangeText={(value) => updateCashTaken(index, 'amount', value)}
                  placeholder="Сумма"
                  placeholderTextColor={COLORS.textSoft}
                />
                <TouchableOpacity style={styles.iconAction} onPress={() => removeCashTaken(index)}>
                  <Text style={styles.iconActionText}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.secondaryGhost} onPress={addCashTaken}>
              <Text style={styles.secondaryGhostText}>Добавить строку выдачи</Text>
            </TouchableOpacity>
          </SurfaceCard>
        </View>

        <View style={styles.secondaryColumn}>
          <SurfaceCard style={styles.sectionCard}>
            <SectionTitle eyebrow="Пересчет" title={diffLabel} />
            <View style={styles.resultMetricRow}>
              <Text style={styles.resultMetricLabel}>Факт</Text>
              <Text style={styles.resultMetricValue}>{formatNum(calc.factTotal)} ₽</Text>
            </View>
            <View style={styles.resultMetricRow}>
              <Text style={styles.resultMetricLabel}>{calc.dashTotal > 10000 ? '3%' : '2%'} от факта</Text>
              <Text style={styles.resultMetricValue}>{formatNum(calc.twoPercent)} ₽</Text>
            </View>
            <View style={styles.resultMetricRow}>
              <Text style={styles.resultMetricLabel}>Из кассы</Text>
              <Text style={styles.resultMetricValue}>{formatNum(cashTakenTotal)} ₽</Text>
            </View>
            <TouchableOpacity
              style={[styles.primaryAction, saving && styles.disabledButton]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.primaryActionText}>{saving ? 'Сохраняем...' : 'Сохранить изменения'}</Text>
            </TouchableOpacity>
          </SurfaceCard>
        </View>
      </View>

      <Modal
        visible={showMultiGoodsPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMultiGoodsPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Несколько товаров</Text>
            <Text style={styles.modalSubtitle}>
              {multiGoodsSourceIndex !== null ? goodsTaken[multiGoodsSourceIndex]?.workerName : ''}
            </Text>
            <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent}>
              {goodsList.map((good) => {
                const selected = selectedGoodsIds.includes(good.id);
                return (
                  <TouchableOpacity
                    key={good.id}
                    style={[styles.modalItem, selected && styles.modalItemSelected]}
                    onPress={() => toggleMultiGoods(good.id)}
                  >
                    <Text style={[styles.modalItemTitle, selected && styles.modalItemTitleSelected]}>
                      {good.title}
                    </Text>
                    <Text style={styles.modalItemMeta}>{formatNum(good.cost)} ₽</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowMultiGoodsPicker(false)}>
                <Text style={styles.modalCancelText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={confirmMultiGoods}>
                <Text style={styles.modalConfirmText}>Добавить {selectedGoodsIds.length}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <PickerModal
        visible={showWorkerPicker}
        title="Выберите сотрудника"
        items={workers.map((worker) => ({ id: worker.id, label: worker.name }))}
        onSelect={selectWorker}
        onClose={() => {
          setShowWorkerPicker(false);
          setPickerTarget(null);
          setCurrentGoodsIndex(null);
          setCurrentCashIndex(null);
        }}
      />

      <PickerModal
        visible={showGoodsPicker}
        title="Выберите товар"
        items={goodsList.map((good) => ({
          id: good.id,
          label: good.title,
          sublabel: `${formatNum(good.cost)} ₽`,
        }))}
        onSelect={selectGoodsItem}
        onClose={() => {
          setShowGoodsPicker(false);
          setCurrentGoodsIndex(null);
        }}
      />
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
  errorText: {
    color: COLORS.danger,
    fontSize: 16,
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
  twoCol: {
    flexDirection: 'row',
    gap: 12,
  },
  field: {
    flex: 1,
  },
  readonlyValue: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    paddingVertical: 12,
  },
  mutedLine: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  pickerField: {
    flex: 2,
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    paddingHorizontal: 14,
    paddingVertical: 14,
    justifyContent: 'center',
  },
  pickerText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  placeholderText: {
    color: COLORS.textSoft,
    fontWeight: '500',
  },
  goodsItem: {
    gap: 10,
  },
  goodsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  quantityInput: {
    width: 88,
    paddingHorizontal: 10,
    textAlign: 'center',
  },
  priceCell: {
    width: 110,
    alignItems: 'flex-end',
  },
  priceText: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  iconAction: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 127, 150, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconActionText: {
    color: COLORS.danger,
    fontSize: 18,
    lineHeight: 20,
  },
  cashRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  cashAmountInput: {
    flex: 1,
  },
  batchGoodsButton: {
    alignSelf: 'flex-start',
  },
  batchGoodsText: {
    color: COLORS.info,
    fontSize: 13,
    fontWeight: '700',
  },
  secondaryGhost: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    backgroundColor: COLORS.surfaceMuted,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryGhostText: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  resultMetricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  resultMetricLabel: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  resultMetricValue: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
  },
  primaryAction: {
    backgroundColor: COLORS.accent,
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryActionText: {
    color: COLORS.background,
    fontSize: 15,
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 720,
    maxHeight: '82%',
    backgroundColor: COLORS.backgroundAlt,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    padding: 20,
    gap: 14,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '800',
  },
  modalSubtitle: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  modalList: {
    flexGrow: 0,
  },
  modalListContent: {
    gap: 10,
    paddingVertical: 4,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  modalItemSelected: {
    borderColor: 'rgba(123, 211, 176, 0.36)',
    backgroundColor: 'rgba(123, 211, 176, 0.12)',
  },
  modalItemTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  modalItemTitleSelected: {
    color: COLORS.accent,
  },
  modalItemMeta: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancel: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceMuted,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalCancelText: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  modalConfirm: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalConfirmText: {
    color: COLORS.background,
    fontSize: 14,
    fontWeight: '800',
  },
});
