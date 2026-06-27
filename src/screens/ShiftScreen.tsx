import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { useIsFocused } from '@react-navigation/native';
import PickerModal from '../components/PickerModal';
import {
  MetricPill,
  ScreenHeader,
  ScreenLayout,
  SectionTitle,
  SurfaceCard,
  sharedInputStyles,
  sharedTextStyles,
  useResponsiveLayout,
} from '../ui/layout';
import { COLORS } from '../ui/theme';
import { ShiftForm, SavedReport, FineRecord } from '../types';
import { calculateShift } from '../utils/calculations';
import { useAuth } from '../utils/AuthContext';
import { getSettings, ShiftSettings } from '../utils/settings';
import {
  getCurrentWorker,
  getGoodsWithPrices,
  getShiftData,
  getUserRole,
  isShellLoggedIn,
} from '../utils/smartshell';
import {
  clearDraft,
  getDraft,
  getUnpaidFines,
  getWorkersFromSupabase,
  saveDraft,
  saveFine,
  saveReport,
} from '../utils/storage';

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

const emptyExpense = () => ({ id: String(Date.now()), name: '', description: '' });
const emptyGoodsRow = (): GoodsDraftRow => ({ workerName: '', goodsName: '', quantity: '', price: '' });
const emptyCashRow = (): CashDraftRow => ({ workerName: '', amount: '' });

const buildReportText = (
  form: ShiftForm,
  calc: ReturnType<typeof calculateShift>,
  workerName: string,
  goodsTaken: GoodsDraftRow[],
  cashTaken: CashDraftRow[],
  fineAmount: string,
  fineReason: string,
  isManager: boolean,
  cleanerAmount: string,
) => {
  const expensesText = form.expenses
    .filter((expense) => expense.name.trim() || expense.description.trim())
    .map((expense) => `${expense.name}: ${expense.description}`)
    .join('\n');

  const goodsText = goodsTaken
    .filter((item) => item.workerName.trim() && item.goodsName.trim())
    .map((item) => {
      const total = (parseInt(item.quantity, 10) || 0) * (parseInt(item.price, 10) || 0);
      return `${item.workerName}: ${item.goodsName} x${item.quantity || '0'} = ${formatNum(total)} ₽`;
    })
    .join('\n');

  const cashText = cashTaken
    .filter((item) => item.workerName.trim() && item.amount.trim())
    .map((item) => `${item.workerName}: ${formatNum(parseInt(item.amount, 10) || 0)} ₽`)
    .join('\n');

  const diffText =
    calc.difference > 0
      ? `Пересдача: +${formatNum(calc.difference)} ₽`
      : calc.difference < 0
        ? `Недосдача: ${formatNum(calc.difference)} ₽`
        : '0 ₽ (сходится)';

  const percentLabel = calc.dashTotal > 10000 ? '3%' : '2%';

  let text = `Сдача смены
Сотрудник: ${workerName || '—'}
---
Дэш: ${formatNum(calc.dashTotal)}
Нал: ${formatNum(parseFloat(form.dashCash) || 0)}
Карта: ${formatNum(parseFloat(form.dashCashless) || 0)}
---
Факт: ${formatNum(calc.factTotal)}
Нал: ${formatNum(parseFloat(form.factCash) || 0)}
Карта: ${formatNum(parseFloat(form.factCashless) || 0)}
Переводы: ${form.transfers ? formatNum(parseInt(form.transfers, 10)) : '0'} ₽
Уборщица: ${cleanerAmount ? formatNum(parseInt(cleanerAmount, 10)) : '0'} ₽
---
Взято товарами:
${goodsText || '—'}
Взято деньгами:
${cashText || '—'}
---
Прочие расходы:
${expensesText || '—'}`;

  if (isManager) {
    text += `\n---\nШтраф: ${
      fineAmount ? `${formatNum(parseInt(fineAmount, 10))} ₽ — ${fineReason || 'Не указана'}` : 'Нет'
    }`;
  }

  text += `\n---\n${percentLabel}: ${formatNum(calc.twoPercent)}\n---\n${diffText}`;
  return text;
};

export default function ShiftScreen() {
  const layout = useResponsiveLayout();
  const { isLoggedIn } = useAuth();
  const isFocused = useIsFocused();
  const userRolesRef = useRef<string[]>([]);

  const [form, setForm] = useState<ShiftForm>({
    dashCash: '',
    dashCashless: '',
    factCash: '',
    factCashless: '',
    transfers: '',
    expenses: [{ id: '1', name: '', description: '' }],
  });
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [smartShellLoaded, setSmartShellLoaded] = useState(false);
  const [workerName, setWorkerName] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [goodsTaken, setGoodsTaken] = useState<GoodsDraftRow[]>([emptyGoodsRow()]);
  const [cashTaken, setCashTaken] = useState<CashDraftRow[]>([emptyCashRow()]);
  const [cleanerAmount, setCleanerAmount] = useState('');
  const [fineAmount, setFineAmount] = useState('');
  const [fineReason, setFineReason] = useState('');
  const [settings, setSettings] = useState<ShiftSettings | null>(null);
  const [isActiveOperator, setIsActiveOperator] = useState(false);
  const [unpaidFines, setUnpaidFines] = useState<FineRecord[]>([]);
  const [workers, setWorkers] = useState<{ id: string; name: string }[]>([]);
  const [goodsList, setGoodsList] = useState<GoodsOption[]>([]);
  const [showWorkerPicker, setShowWorkerPicker] = useState(false);
  const [showGoodsPicker, setShowGoodsPicker] = useState(false);
  const [showMultiGoodsPicker, setShowMultiGoodsPicker] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<'mainWorker' | 'goodsWorker' | 'cashWorker' | null>(null);
  const [currentGoodsIndex, setCurrentGoodsIndex] = useState<number | null>(null);
  const [currentCashIndex, setCurrentCashIndex] = useState<number | null>(null);
  const [multiGoodsSourceIndex, setMultiGoodsSourceIndex] = useState<number | null>(null);
  const [selectedGoodsIds, setSelectedGoodsIds] = useState<string[]>([]);

  const cashTakenTotal = useMemo(
    () => cashTaken.reduce((sum, item) => sum + (parseInt(item.amount, 10) || 0), 0),
    [cashTaken]
  );

  const calc = useMemo(
    () => calculateShift(form, parseInt(cleanerAmount, 10) || 0, cashTakenTotal),
    [form, cleanerAmount, cashTakenTotal]
  );

  const isManager = () =>
    userRolesRef.current.some((role) => {
      const normalized = role.toLowerCase();
      return normalized.includes('manager') || normalized.includes('owner') || normalized.includes('admin');
    });

  const showAllBlocks = !isManager() || isActiveOperator;

  useEffect(() => {
    loadDraft();
    loadShiftSettings();
  }, []);

  useEffect(() => {
    if (isFocused) {
      loadShiftSettings();
    }
  }, [isFocused]);

  useEffect(() => {
    const timer = setTimeout(() => {
      saveDraft({
        form,
        workerName,
        goodsTaken,
        cashTaken,
        cleanerAmount,
        fineAmount,
        fineReason,
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [form, workerName, goodsTaken, cashTaken, cleanerAmount, fineAmount, fineReason]);

  useEffect(() => {
    if (isLoggedIn && isShellLoggedIn()) {
      fetchAllData();
      setAutoRefresh(true);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (!autoRefresh || !isShellLoggedIn()) return;

    const interval = setInterval(async () => {
      try {
        const data = await getShiftData();
        if (data) {
          setForm((prev) => ({
            ...prev,
            dashCash: String(data.cash),
            dashCashless: String(data.cashless),
          }));
        }
      } catch (error) {}
    }, 15000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const loadDraft = async () => {
    const draft = await getDraft();
    if (!draft) return;

    if (draft.form) setForm(draft.form);
    if (draft.workerName) setWorkerName(draft.workerName);
    if (draft.goodsTaken?.length) setGoodsTaken(draft.goodsTaken);
    if (draft.cashTaken?.length) setCashTaken(draft.cashTaken);
    if (draft.cleanerAmount) setCleanerAmount(draft.cleanerAmount);
    if (draft.fineAmount) setFineAmount(draft.fineAmount);
    if (draft.fineReason) setFineReason(draft.fineReason);
  };

  const loadShiftSettings = async () => {
    const currentSettings = await getSettings();
    setSettings(currentSettings);
  };

  const fetchAllData = async () => {
    try {
      const [shiftData, workersData, roles, goodsData] = await Promise.all([
        getShiftData(),
        getWorkersFromSupabase(),
        getUserRole(),
        getGoodsWithPrices(),
      ]);

      if (shiftData) {
        setForm((prev) => ({
          ...prev,
          dashCash: String(shiftData.cash),
          dashCashless: String(shiftData.cashless),
        }));
        setSmartShellLoaded(true);
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

      userRolesRef.current = roles;
      setIsActiveOperator(roles.some((role) => role.toLowerCase().includes('active_operator')));

      const activeOperator = workersData.find(
        (worker: any) => worker.role && String(worker.role).toLowerCase().includes('active_operator')
      );

      if (activeOperator) {
        const fullName = [activeOperator.first_name, activeOperator.last_name].filter(Boolean).join(' ');
        if (fullName) {
          setWorkerName(fullName);
        }
      } else {
        const currentWorker = await getCurrentWorker();
        if (currentWorker) {
          setWorkerName(currentWorker);
        }
      }

      setGoodsList(goodsData);
    } catch (error) {}
  };

  const updateExpense = (id: string, field: 'name' | 'description', value: string) => {
    setForm((prev) => {
      const expenses = prev.expenses.map((expense) =>
        expense.id === id ? { ...expense, [field]: value } : expense
      );

      const lastExpense = expenses[expenses.length - 1];
      if (lastExpense.name.trim() || lastExpense.description.trim()) {
        expenses.push(emptyExpense());
      }

      return { ...prev, expenses };
    });
  };

  const removeExpense = (id: string) => {
    setForm((prev) => {
      const expenses = prev.expenses.filter((expense) => expense.id !== id);
      if (!expenses.length) {
        expenses.push(emptyExpense());
      }
      return { ...prev, expenses };
    });
  };

  const addGoodsTaken = () => setGoodsTaken((prev) => [...prev, emptyGoodsRow()]);

  const updateGoodsTaken = (
    index: number,
    field: keyof GoodsDraftRow,
    value: string
  ) => {
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

  const addCashTaken = () => setCashTaken((prev) => [...prev, emptyCashRow()]);

  const updateCashTaken = (
    index: number,
    field: keyof CashDraftRow,
    value: string
  ) => {
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

  const selectWorker = async (item: { id: string; label: string }) => {
    if (pickerTarget === 'mainWorker') {
      setWorkerName(item.label);
      if (item.label) {
        setUnpaidFines(await getUnpaidFines(item.label));
      }
    }

    if (pickerTarget === 'goodsWorker' && currentGoodsIndex !== null) {
      updateGoodsTaken(currentGoodsIndex, 'workerName', item.label);
      if (item.label) {
        setUnpaidFines(await getUnpaidFines(item.label));
      }
    }

    if (pickerTarget === 'cashWorker' && currentCashIndex !== null) {
      updateCashTaken(currentCashIndex, 'workerName', item.label);
      if (item.label) {
        setUnpaidFines(await getUnpaidFines(item.label));
      }
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
      Alert.alert('Выберите сотрудника', 'Сначала укажите сотрудника для этой строки.');
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

  const handleIssueFine = async () => {
    const amount = parseInt(fineAmount, 10) || 0;
    if (amount <= 0) {
      Alert.alert('Ошибка', 'Введите сумму штрафа.');
      return;
    }

    if (!workerName.trim()) {
      Alert.alert('Ошибка', 'Сначала выберите сотрудника.');
      return;
    }

    await saveFine({
      id: String(Date.now()),
      workerName,
      amount,
      reason: fineReason || 'Не указана',
      date: new Date().toISOString(),
      paid: false,
    });

    setUnpaidFines(await getUnpaidFines(workerName));
    setFineAmount('');
    setFineReason('');
    Alert.alert('Готово', `Штраф ${amount} ₽ выписан сотруднику ${workerName}.`);
  };

  const pickFromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Нет доступа', 'Камера недоступна.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({ quality: 0.3, base64: true });
    if (result.canceled || !result.assets[0]) return;

    const manipulated = await ImageManipulator.manipulateAsync(
      result.assets[0].uri,
      [{ resize: { width: 400 } }],
      {
        compress: 0.3,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      }
    );

    setPhotoUri(manipulated.uri);
    setPhotoBase64(manipulated.base64 || null);
  };

  const pickFromGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Нет доступа', 'Галерея недоступна.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.3, base64: true });
    if (result.canceled || !result.assets[0]) return;

    const manipulated = await ImageManipulator.manipulateAsync(
      result.assets[0].uri,
      [{ resize: { width: 400 } }],
      {
        compress: 0.3,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      }
    );

    setPhotoUri(manipulated.uri);
    setPhotoBase64(manipulated.base64 || null);
  };

  const showPhotoOptions = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Камера', 'Галерея', 'Отмена'], cancelButtonIndex: 2 },
        (index) => {
          if (index === 0) pickFromCamera();
          if (index === 1) pickFromGallery();
        }
      );
      return;
    }

    Alert.alert('Фото', 'Выберите источник', [
      { text: 'Камера', onPress: pickFromCamera },
      { text: 'Галерея', onPress: pickFromGallery },
      { text: 'Отмена', style: 'cancel' },
    ]);
  };

  const resetForm = () => {
    setForm({
      dashCash: '',
      dashCashless: '',
      factCash: '',
      factCashless: '',
      transfers: '',
      expenses: [{ id: String(Date.now()), name: '', description: '' }],
    });
    setPhotoUri(null);
    setPhotoBase64(null);
    setGoodsTaken([emptyGoodsRow()]);
    setCashTaken([emptyCashRow()]);
    setCleanerAmount('');
    setFineAmount('');
    setFineReason('');
  };

  const handleShare = async () => {
    if (!form.factCash && !form.factCashless) {
      Alert.alert('Ошибка', 'Заполните блок "Факт".');
      return;
    }

    setSending(true);
    setAutoRefresh(false);

    try {
      const text = buildReportText(
        form,
        calc,
        workerName,
        goodsTaken,
        cashTaken,
        fineAmount,
        fineReason,
        isManager(),
        cleanerAmount
      );

      const report: SavedReport = {
        id: String(Date.now() * 1000 + Math.floor(Math.random() * 1000)),
        date: new Date().toISOString(),
        workerName,
        dashTotal: calc.dashTotal,
        dashCash: parseFloat(form.dashCash) || 0,
        dashCashless: parseFloat(form.dashCashless) || 0,
        factTotal: calc.factTotal,
        factCash: parseFloat(form.factCash) || 0,
        factCashless: parseFloat(form.factCashless) || 0,
        expenses: form.expenses
          .filter((expense) => expense.name.trim() || expense.description.trim())
          .map((expense) => ({ name: expense.name, description: expense.description })),
        twoPercent: calc.twoPercent,
        difference: calc.difference,
        photoBase64: photoBase64 || undefined,
        goodsTaken: goodsTaken
          .filter((item) => item.workerName.trim() && item.goodsName.trim())
          .map((item) => ({
            workerName: item.workerName,
            name: item.goodsName,
            quantity: parseInt(item.quantity, 10) || 0,
            price: parseInt(item.price, 10) || 0,
          })),
        cashTakenItems: cashTaken
          .filter((item) => item.workerName.trim() && item.amount.trim())
          .map((item) => ({
            workerName: item.workerName,
            amount: parseInt(item.amount, 10) || 0,
          })),
        cleanerAmount: parseInt(cleanerAmount, 10) || 0,
        transfers: parseInt(form.transfers, 10) || 0,
        fine:
          isManager() && parseInt(fineAmount, 10) > 0
            ? {
                amount: parseInt(fineAmount, 10),
                reason: fineReason || 'Не указана',
              }
            : undefined,
      };

      await saveReport(report);
      await saveDraft({});
      await clearDraft();

      if (photoUri) {
        await Sharing.shareAsync(photoUri, { mimeType: 'image/jpeg', dialogTitle: text });
      } else {
        await Share.share({ message: text });
      }

      resetForm();
      setTimeout(() => {
        setAutoRefresh(true);
        fetchAllData();
      }, 2000);
    } catch (error: any) {
      Alert.alert('Ошибка', error?.message || 'Не удалось отправить отчет.');
    } finally {
      setSending(false);
    }
  };

  const diffLabel =
    calc.difference > 0
      ? `Пересдача: +${formatNum(calc.difference)} ₽`
      : calc.difference < 0
        ? `Недосдача: ${formatNum(calc.difference)} ₽`
        : 'Баланс сошелся';

  const diffColor = calc.difference >= 0 ? COLORS.accent : COLORS.danger;
  const diffCardStyle = {
    backgroundColor: calc.difference >= 0 ? 'rgba(123, 211, 176, 0.12)' : 'rgba(255, 127, 150, 0.12)',
    borderColor: calc.difference >= 0 ? 'rgba(123, 211, 176, 0.28)' : 'rgba(255, 127, 150, 0.28)',
  };

  const percentLabel = calc.dashTotal > 10000 ? '3%' : '2%';
  const totalGoodsSum = goodsTaken.reduce((sum, item) => {
    return sum + (parseInt(item.quantity, 10) || 0) * (parseInt(item.price, 10) || 0);
  }, 0);

  return (
    <ScreenLayout>
      <ScreenHeader
        title="Сдача смены"
        subtitle="Фиксируем факт, движения по кассе и товары. Для одного сотрудника можно добавить сразу несколько товаров."
      />

      <View style={[styles.topGrid, layout.isDesktop && styles.topGridDesktop]}>
        <MetricPill label="Дэш" value={`${formatNum(calc.dashTotal)} ₽`} accent />
        <MetricPill label="Факт" value={`${formatNum(calc.factTotal)} ₽`} />
        <MetricPill label="Товары" value={`${formatNum(totalGoodsSum)} ₽`} />
        <MetricPill label="Из кассы" value={`${formatNum(cashTakenTotal)} ₽`} />
      </View>

      <View style={[styles.mainGrid, layout.isDesktop && styles.mainGridDesktop]}>
        <View style={styles.primaryColumn}>
          {settings?.showWorker !== false ? (
            <SurfaceCard style={styles.sectionCard}>
              <SectionTitle eyebrow="Сотрудник" title="Кто закрывает смену" />
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => {
                  setPickerTarget('mainWorker');
                  setShowWorkerPicker(true);
                }}
              >
                <Text style={[styles.pickerText, !workerName && styles.placeholderText]}>
                  {workerName || 'Выберите сотрудника'}
                </Text>
              </TouchableOpacity>
            </SurfaceCard>
          ) : null}

          {settings?.showDash !== false ? (
            <SurfaceCard style={styles.sectionCard}>
              <SectionTitle
                eyebrow="Дэш"
                title="Данные терминала"
                subtitle="Здесь лежит исходная выручка из SmartShell."
              />
              <View style={styles.twoCol}>
                <View style={styles.field}>
                  <Text style={sharedTextStyles.label}>Наличные</Text>
                  <TextInput
                    style={sharedInputStyles.input}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={COLORS.textSoft}
                    value={form.dashCash}
                    onChangeText={(value) => setForm({ ...form, dashCash: value })}
                  />
                </View>
                <View style={styles.field}>
                  <Text style={sharedTextStyles.label}>Карта</Text>
                  <TextInput
                    style={sharedInputStyles.input}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={COLORS.textSoft}
                    value={form.dashCashless}
                    onChangeText={(value) => setForm({ ...form, dashCashless: value })}
                  />
                </View>
              </View>
              <Text style={styles.mutedLine}>Итого: {formatNum(calc.dashTotal)} ₽</Text>
              {!smartShellLoaded && isLoggedIn ? (
                <TouchableOpacity style={styles.secondaryAction} onPress={fetchAllData}>
                  <Text style={styles.secondaryActionText}>Загрузить из SmartShell</Text>
                </TouchableOpacity>
              ) : null}
            </SurfaceCard>
          ) : null}

          {settings?.showFact !== false ? (
            <SurfaceCard style={styles.sectionCard}>
              <SectionTitle eyebrow="Факт" title="Сданные суммы" />
              <View style={styles.twoCol}>
                <View style={styles.field}>
                  <Text style={sharedTextStyles.label}>Наличные</Text>
                  <TextInput
                    style={sharedInputStyles.input}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={COLORS.textSoft}
                    value={form.factCash}
                    onChangeText={(value) => setForm({ ...form, factCash: value })}
                  />
                </View>
                <View style={styles.field}>
                  <Text style={sharedTextStyles.label}>Карта</Text>
                  <TextInput
                    style={sharedInputStyles.input}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={COLORS.textSoft}
                    value={form.factCashless}
                    onChangeText={(value) => setForm({ ...form, factCashless: value })}
                  />
                </View>
              </View>
              <View style={styles.singleCol}>
                <View style={styles.field}>
                  <Text style={sharedTextStyles.label}>Переводы</Text>
                  <TextInput
                    style={sharedInputStyles.input}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={COLORS.textSoft}
                    value={form.transfers}
                    onChangeText={(value) => setForm({ ...form, transfers: value })}
                  />
                </View>
              </View>
              <Text style={styles.mutedLine}>Итого: {formatNum(calc.factTotal)} ₽</Text>
            </SurfaceCard>
          ) : null}

          {settings?.showGoodsTaken !== false ? (
            <SurfaceCard style={styles.sectionCard}>
              <SectionTitle
                eyebrow="Товары"
                title="Товары под зарплату"
                subtitle="Можно выбрать один товар или добавить пачку товаров для уже выбранного сотрудника."
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
                      placeholder="Кол"
                      placeholderTextColor={COLORS.textSoft}
                      value={item.quantity}
                      onChangeText={(value) => updateGoodsTaken(index, 'quantity', value)}
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
          ) : null}

          {settings?.showCashTaken !== false ? (
            <SurfaceCard style={styles.sectionCard}>
              <SectionTitle eyebrow="Касса" title="Деньги, взятые из кассы" />
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
                    placeholder="Сумма"
                    placeholderTextColor={COLORS.textSoft}
                    value={item.amount}
                    onChangeText={(value) => updateCashTaken(index, 'amount', value)}
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
          ) : null}
        </View>

        <View style={styles.secondaryColumn}>
          {settings?.showCleaner !== false ? (
            <SurfaceCard style={styles.sectionCard}>
              <SectionTitle eyebrow="Уборщица" title="Доплата" />
              <TextInput
                style={sharedInputStyles.input}
                keyboardType="numeric"
                placeholder="Сумма"
                placeholderTextColor={COLORS.textSoft}
                value={cleanerAmount}
                onChangeText={setCleanerAmount}
              />
            </SurfaceCard>
          ) : null}

          {isManager() && !isActiveOperator ? (
            <SurfaceCard style={styles.sectionCard}>
              <SectionTitle eyebrow="Штраф" title="Выписать штраф" />
              <View style={styles.twoCol}>
                <View style={styles.field}>
                  <Text style={sharedTextStyles.label}>Сумма</Text>
                  <TextInput
                    style={sharedInputStyles.input}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={COLORS.textSoft}
                    value={fineAmount}
                    onChangeText={setFineAmount}
                  />
                </View>
                <View style={styles.field}>
                  <Text style={sharedTextStyles.label}>Причина</Text>
                  <TextInput
                    style={sharedInputStyles.input}
                    placeholder="Причина"
                    placeholderTextColor={COLORS.textSoft}
                    value={fineReason}
                    onChangeText={setFineReason}
                  />
                </View>
              </View>
              <TouchableOpacity style={styles.secondaryAction} onPress={handleIssueFine}>
                <Text style={styles.secondaryActionText}>Выписать штраф</Text>
              </TouchableOpacity>
              {unpaidFines.length > 0 ? (
                <View style={styles.alertBlock}>
                  <Text style={styles.alertTitle}>Неоплаченные штрафы</Text>
                  {unpaidFines.map((fine) => (
                    <Text key={fine.id} style={styles.alertText}>
                      {new Date(fine.date).toLocaleDateString('ru-RU')} • {formatNum(fine.amount)} ₽ • {fine.reason}
                    </Text>
                  ))}
                </View>
              ) : null}
            </SurfaceCard>
          ) : null}

          {settings?.showFine !== false && isManager() && isActiveOperator ? (
            <SurfaceCard style={styles.sectionCard}>
              <SectionTitle eyebrow="Штраф" title="Штраф в отчете" />
              <View style={styles.twoCol}>
                <View style={styles.field}>
                  <Text style={sharedTextStyles.label}>Сумма</Text>
                  <TextInput
                    style={sharedInputStyles.input}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={COLORS.textSoft}
                    value={fineAmount}
                    onChangeText={setFineAmount}
                  />
                </View>
                <View style={styles.field}>
                  <Text style={sharedTextStyles.label}>Причина</Text>
                  <TextInput
                    style={sharedInputStyles.input}
                    placeholder="Причина"
                    placeholderTextColor={COLORS.textSoft}
                    value={fineReason}
                    onChangeText={setFineReason}
                  />
                </View>
              </View>
            </SurfaceCard>
          ) : null}

          {settings?.showOtherExpenses !== false ? (
            <SurfaceCard style={styles.sectionCard}>
              <SectionTitle eyebrow="Расходы" title="Прочие расходы" />
              {form.expenses.map((expense, index) => {
                const isLast = index === form.expenses.length - 1;
                const hasValue = expense.name.trim() || expense.description.trim();
                return (
                  <View key={expense.id} style={styles.expenseRow}>
                    <View style={styles.field}>
                      <TextInput
                        style={sharedInputStyles.input}
                        placeholder="Имя"
                        placeholderTextColor={COLORS.textSoft}
                        value={expense.name}
                        onChangeText={(value) => updateExpense(expense.id, 'name', value)}
                      />
                    </View>
                    <View style={styles.field}>
                      <TextInput
                        style={sharedInputStyles.input}
                        placeholder="Описание"
                        placeholderTextColor={COLORS.textSoft}
                        value={expense.description}
                        onChangeText={(value) => updateExpense(expense.id, 'description', value)}
                      />
                    </View>
                    {!isLast || !hasValue ? (
                      <TouchableOpacity style={styles.iconAction} onPress={() => removeExpense(expense.id)}>
                        <Text style={styles.iconActionText}>×</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.iconSpacer} />
                    )}
                  </View>
                );
              })}

              {settings?.showPhoto !== false ? (
                <View style={styles.photoBlock}>
                  <TouchableOpacity style={styles.secondaryGhost} onPress={showPhotoOptions}>
                    <Text style={styles.secondaryGhostText}>
                      {photoUri ? 'Заменить фото чека' : 'Добавить фото чека'}
                    </Text>
                  </TouchableOpacity>
                  {photoUri ? (
                    <View style={styles.photoPreview}>
                      <Image source={{ uri: photoUri }} style={styles.photoImage} />
                      <TouchableOpacity
                        style={styles.photoRemoveButton}
                        onPress={() => {
                          setPhotoUri(null);
                          setPhotoBase64(null);
                        }}
                      >
                        <Text style={styles.photoRemoveText}>Удалить фото</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </SurfaceCard>
          ) : null}

          <SurfaceCard style={[styles.resultCard, diffCardStyle]}>
            <SectionTitle eyebrow="Итог" title={diffLabel} />
            <View style={styles.resultMetricRow}>
              <Text style={styles.resultMetricLabel}>{percentLabel} от факта</Text>
              <Text style={styles.resultMetricValue}>{formatNum(calc.twoPercent)} ₽</Text>
            </View>
            <View style={styles.resultMetricRow}>
              <Text style={styles.resultMetricLabel}>Отклонение</Text>
              <Text style={[styles.resultMetricValue, { color: diffColor }]}>{diffLabel.replace(/^.*:\s*/, '')}</Text>
            </View>
            <TouchableOpacity
              style={[styles.primaryAction, sending && styles.disabledButton]}
              onPress={handleShare}
              disabled={sending}
            >
              <Text style={styles.primaryActionText}>{sending ? 'Отправка...' : 'Отправить отчет'}</Text>
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
  topGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 18,
  },
  topGridDesktop: {
    flexWrap: 'nowrap',
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
  singleCol: {
    gap: 12,
  },
  field: {
    flex: 1,
  },
  mutedLine: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  pickerButton: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    paddingHorizontal: 14,
    paddingVertical: 14,
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
  iconSpacer: {
    width: 34,
  },
  batchGoodsButton: {
    alignSelf: 'flex-start',
  },
  batchGoodsText: {
    color: COLORS.info,
    fontSize: 13,
    fontWeight: '700',
  },
  cashRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  cashAmountInput: {
    flex: 1,
  },
  secondaryAction: {
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
  alertBlock: {
    gap: 6,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 127, 150, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 127, 150, 0.18)',
  },
  alertTitle: {
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  alertText: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  expenseRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  photoBlock: {
    gap: 12,
  },
  photoPreview: {
    gap: 10,
  },
  photoImage: {
    width: '100%',
    height: 220,
    borderRadius: 18,
    resizeMode: 'cover',
  },
  photoRemoveButton: {
    alignSelf: 'flex-start',
  },
  photoRemoveText: {
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  resultCard: {
    gap: 16,
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
