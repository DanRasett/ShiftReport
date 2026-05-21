import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { loginToSmartShell, logoutFromSmartShell, getDetailedWorkers, getUserRole } from './smartshell';
import { getCredentials, saveCredentials, removeCredentials, syncWorkersToSupabase } from './storage';

const COLORS = {
  bg: '#1a1d23',
  card: '#21242b',
  border: '#2a2d35',
  text: '#e0e0e0',
  textDim: '#8b8d94',
  green: '#4caf93',
  inputBg: '#282c34',
  red: '#e0556a',
};

interface AuthContextType {
  isLoggedIn: boolean;
  showLoginModal: () => void;
  logout: () => Promise<void>;
  userRoles: string[];
}

const AuthContext = createContext<AuthContextType>({
  isLoggedIn: false,
  showLoginModal: () => {},
  logout: async () => {},
  userRoles: [],
});

export const useAuth = () => useContext(AuthContext);

const normalizePhone = (phone: string): string => {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('8')) {
    cleaned = '7' + cleaned.substring(1);
  }
  if (cleaned.length === 10) {
    cleaned = '7' + cleaned;
  }
  return cleaned;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [tempLogin, setTempLogin] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [userRoles, setUserRoles] = useState<string[]>([]);

  useEffect(() => {
    autoLogin();
  }, []);

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
    } catch (syncError) {
      console.log('Ошибка синхронизации сотрудников:', syncError);
    }
  };

  const handleLogin = async () => {
    if (!tempLogin.trim()) {
      setLoginError('Введите логин');
      return;
    }
    if (!tempPassword.trim()) {
      setLoginError('Введите пароль');
      return;
    }

    setLoginLoading(true);
    setLoginError('');

    const normalizedLogin = normalizePhone(tempLogin.trim());

    const success = await loginToSmartShell({
      login: normalizedLogin,
      password: tempPassword,
    });

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
    } else {
      setLoginError('Неверный логин или пароль');
    }

    setLoginLoading(false);
  };

  const showLoginModal = () => {
    setTempLogin('');
    setTempPassword('');
    setLoginError('');
    setShowLogin(true);
  };

  const logout = async () => {
    try {
      await logoutFromSmartShell();
      await removeCredentials();
    } catch (e) {
      console.log('Ошибка выхода:', e);
    }
    setIsLoggedIn(false);
    setUserRoles([]);
    setShowLogin(true);
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, showLoginModal, logout, userRoles }}>
      {children}

      <Modal visible={showLogin && !isLoggedIn} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Вход в SmartShell</Text>
            <Text style={styles.modalSubtitle}>Введите данные для входа в систему</Text>

            <Text style={styles.modalLabel}>Логин (номер телефона):</Text>
            <TextInput
              style={styles.modalInput}
              value={tempLogin}
              onChangeText={(v) => { setTempLogin(v); setLoginError(''); }}
              keyboardType="phone-pad"
              autoFocus
              placeholder="+7 (999) 123-45-67"
              placeholderTextColor={COLORS.textDim}
              returnKeyType="next"
            />

            <Text style={styles.modalLabel}>Пароль:</Text>
            <TextInput
              style={styles.modalInput}
              value={tempPassword}
              onChangeText={(v) => { setTempPassword(v); setLoginError(''); }}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor={COLORS.textDim}
              returnKeyType="go"
              onSubmitEditing={handleLogin}
            />

            {loginError ? (
              <Text style={styles.errorText}>{loginError}</Text>
            ) : null}

            <TouchableOpacity
              style={[styles.modalOkBtn, loginLoading && { opacity: 0.6 }]}
              onPress={handleLogin}
              disabled={loginLoading}
            >
              <Text style={styles.modalOkText}>
                {loginLoading ? 'Вход...' : 'Войти'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </AuthContext.Provider>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 24,
    width: '88%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  modalSubtitle: {
    color: COLORS.textDim,
    fontSize: 13,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalLabel: {
    color: COLORS.textDim,
    fontSize: 14,
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: COLORS.inputBg,
    borderRadius: 10,
    padding: 14,
    color: COLORS.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  errorText: {
    color: COLORS.red,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
  modalOkBtn: {
    padding: 14,
    borderRadius: 10,
    backgroundColor: COLORS.green,
    alignItems: 'center',
  },
  modalOkText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});