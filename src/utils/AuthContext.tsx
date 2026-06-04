import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Modal, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { loginToSmartShell, logoutFromSmartShell, getDetailedWorkers, getUserRole, getGoodsLogs } from './smartshell';
import { getCredentials, saveCredentials, removeCredentials, syncWorkersToSupabase, getHistory } from './storage';

const COLORS = {
  bg: '#1a1d23', card: '#21242b', border: '#2a2d35', text: '#e0e0e0',
  textDim: '#8b8d94', green: '#4caf93', inputBg: '#282c34', red: '#e0556a',
  yellow: '#f0c040',
};

interface AuthContextType {
  isLoggedIn: boolean;
  showLoginModal: () => void;
  logout: () => Promise<void>;
  userRoles: string[];
}

const AuthContext = createContext<AuthContextType>({
  isLoggedIn: false, showLoginModal: () => {}, logout: async () => {}, userRoles: [],
});

export const useAuth = () => useContext(AuthContext);

const normalizePhone = (phone: string): string => {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('8')) cleaned = '7' + cleaned.substring(1);
  if (cleaned.length === 10) cleaned = '7' + cleaned;
  return cleaned;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [tempLogin, setTempLogin] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [loginStats, setLoginStats] = useState<{
    totalShifts: number;
    totalRevenue: number;
    goodsTakenFromReports: { name: string; quantity: number }[];
    goodsFromLogs: { goodName: string; quantity: number; type: string }[];
    unmatchedGoods: string[];
  } | null>(null);

  useEffect(() => { autoLogin(); }, []);

  const autoLogin = async () => {
    const creds = await getCredentials();
    if (creds) {
      const success = await loginToSmartShell(creds);
      setIsLoggedIn(success);
      if (success) {
        syncWorkersFromShell();
        const roles = await getUserRole();
        setUserRoles(roles);
      } else {
        setShowLogin(true);
      }
    } else {
      setShowLogin(true);
    }
  };

  const syncWorkersFromShell = async () => {
    try {
      const detailedWorkers = await getDetailedWorkers();
      if (detailedWorkers.length > 0) {
        await syncWorkersToSupabase(detailedWorkers);
      }
    } catch (e) {}
  };

  const loadLoginStats = async () => {
    setStatsLoading(true);
    try {
      const [history, goodsLogs] = await Promise.all([
        getHistory(),
        getGoodsLogs(),
      ]);

      const totalShifts = history.length;
      const totalRevenue = history.reduce((s, r) => s + r.factTotal, 0);

      const goodsTakenFromReports: { name: string; quantity: number }[] = [];
      history.forEach(r => {
        if (r.goodsTaken) {
          r.goodsTaken.forEach(g => {
            const existing = goodsTakenFromReports.find(x => x.name === g.name);
            if (existing) existing.quantity += g.quantity || 0;
            else goodsTakenFromReports.push({ name: g.name, quantity: g.quantity || 0 });
          });
        }
      });

      // Сверяем: если товар есть в логах списания — он verified
      const unmatchedGoods: string[] = [];
      goodsTakenFromReports.forEach(g => {
        const found = goodsLogs.find(l => l.goodName === g.name);
        if (!found) unmatchedGoods.push(g.name);
      });

      setLoginStats({
        totalShifts,
        totalRevenue,
        goodsTakenFromReports,
        goodsFromLogs: goodsLogs,
        unmatchedGoods,
      });
    } catch (e) {}
    setStatsLoading(false);
  };

  const handleLogin = async () => {
    if (!tempLogin.trim()) { setLoginError('Введите логин'); return; }
    if (!tempPassword.trim()) { setLoginError('Введите пароль'); return; }

    setLoginLoading(true);
    setLoginError('');

    const normalizedLogin = normalizePhone(tempLogin.trim());
    const success = await loginToSmartShell({ login: normalizedLogin, password: tempPassword });

    if (success) {
      await saveCredentials(normalizedLogin, tempPassword);
      const roles = await getUserRole();
      setUserRoles(roles);
      setIsLoggedIn(true);
      setShowLogin(false);
      setTempLogin('');
      setTempPassword('');
      setLoginError('');
      syncWorkersFromShell();
      loadLoginStats();
      setShowStats(true);
    } else {
      setLoginError('Неверный логин или пароль');
    }
    setLoginLoading(false);
  };

  const showLoginModal = () => {
    setTempLogin(''); setTempPassword(''); setLoginError(''); setShowLogin(true);
  };

  const logout = async () => {
    try { await logoutFromSmartShell(); await removeCredentials(); } catch (e) {}
    setIsLoggedIn(false); setUserRoles([]); setShowLogin(true);
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, showLoginModal, logout, userRoles }}>
      {children}

      {/* Модальное окно входа */}
      <Modal visible={showLogin && !isLoggedIn} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Вход в SmartShell</Text>
            <Text style={styles.modalSubtitle}>Введите данные для входа в систему</Text>
            <Text style={styles.modalLabel}>Логин (номер телефона):</Text>
            <TextInput style={styles.modalInput} value={tempLogin} onChangeText={(v) => { setTempLogin(v); setLoginError(''); }} keyboardType="phone-pad" autoFocus placeholder="+7 (999) 123-45-67" placeholderTextColor={COLORS.textDim} returnKeyType="next" />
            <Text style={styles.modalLabel}>Пароль:</Text>
            <TextInput style={styles.modalInput} value={tempPassword} onChangeText={(v) => { setTempPassword(v); setLoginError(''); }} secureTextEntry placeholder="••••••••" placeholderTextColor={COLORS.textDim} returnKeyType="go" onSubmitEditing={handleLogin} />
            {loginError ? <Text style={styles.errorText}>{loginError}</Text> : null}
            <TouchableOpacity style={[styles.modalOkBtn, loginLoading && { opacity: 0.6 }]} onPress={handleLogin} disabled={loginLoading}>
              <Text style={styles.modalOkText}>{loginLoading ? 'Вход...' : 'Войти'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Модальное окно статистики после входа */}
      <Modal visible={showStats && isLoggedIn} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.statsCard}>
            <Text style={styles.statsTitle}>Статистика</Text>

            {statsLoading ? (
              <ActivityIndicator size="large" color={COLORS.green} />
            ) : loginStats ? (
              <ScrollView style={styles.statsScroll}>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Всего смен:</Text>
                  <Text style={styles.statValue}>{loginStats.totalShifts}</Text>
                </View>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Общая выручка:</Text>
                  <Text style={styles.statValue}>{loginStats.totalRevenue.toLocaleString('ru-RU')} ₽</Text>
                </View>

                {loginStats.goodsTakenFromReports.length > 0 && (
                  <>
                    <Text style={styles.statsSubtitle}>Товары, взятые под ЗП:</Text>
                    {loginStats.goodsTakenFromReports.map((g, i) => {
                      const logEntry = loginStats.goodsFromLogs.find(l => l.goodName === g.name);
                      const verified = !!logEntry;
                      return (
                        <View key={i} style={styles.goodsRow}>
                          <Text style={styles.goodsName}>{g.name}: {g.quantity} шт</Text>
                          <Text style={{ color: verified ? COLORS.green : COLORS.red, fontSize: 12 }}>
                            {verified ? '✓ Списан' : '✗ Не списан'}
                          </Text>
                        </View>
                      );
                    })}
                  </>
                )}

                {loginStats.unmatchedGoods.length > 0 && (
                  <View style={styles.warningBox}>
                    <Text style={styles.warningText}>
                      ⚠️ Товары не найдены в логах списания: {loginStats.unmatchedGoods.join(', ')}
                    </Text>
                  </View>
                )}
              </ScrollView>
            ) : null}

            <TouchableOpacity style={styles.statsCloseBtn} onPress={() => setShowStats(false)}>
              <Text style={styles.statsCloseText}>Закрыть</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </AuthContext.Provider>
  );
};

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { backgroundColor: COLORS.card, borderRadius: 16, padding: 24, width: '88%', maxWidth: 400, borderWidth: 1, borderColor: COLORS.border },
  modalTitle: { color: COLORS.text, fontSize: 22, fontWeight: '700', marginBottom: 6, textAlign: 'center' },
  modalSubtitle: { color: COLORS.textDim, fontSize: 13, marginBottom: 20, textAlign: 'center' },
  modalLabel: { color: COLORS.textDim, fontSize: 14, marginBottom: 8 },
  modalInput: { backgroundColor: COLORS.inputBg, borderRadius: 10, padding: 14, color: COLORS.text, fontSize: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 16 },
  errorText: { color: COLORS.red, fontSize: 13, textAlign: 'center', marginBottom: 12 },
  modalOkBtn: { padding: 14, borderRadius: 10, backgroundColor: COLORS.green, alignItems: 'center' },
  modalOkText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  statsCard: { backgroundColor: COLORS.card, borderRadius: 16, padding: 24, width: '88%', maxWidth: 400, maxHeight: '80%', borderWidth: 1, borderColor: COLORS.border },
  statsTitle: { color: COLORS.text, fontSize: 20, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  statsScroll: { maxHeight: 400 },
  statsSubtitle: { color: COLORS.text, fontSize: 14, fontWeight: '600', marginTop: 12, marginBottom: 8 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  statLabel: { color: COLORS.textDim, fontSize: 14 },
  statValue: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
  goodsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4, paddingLeft: 12 },
  goodsName: { color: COLORS.textDim, fontSize: 13 },
  warningBox: { backgroundColor: COLORS.red + '20', borderRadius: 8, padding: 12, marginTop: 12 },
  warningText: { color: COLORS.red, fontSize: 12 },
  statsCloseBtn: { marginTop: 16, padding: 12, borderRadius: 10, backgroundColor: COLORS.inputBg, alignItems: 'center' },
  statsCloseText: { color: COLORS.textDim, fontSize: 14, fontWeight: '600' },
});