import React from 'react';
import { StatusBar, TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import ShiftScreen from './src/screens/ShiftScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import GoodsScreen from './src/screens/GoodsScreen';
import SalaryScreen from './src/screens/SalaryScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { AuthProvider, useAuth } from './src/utils/AuthContext';

const Tab = createBottomTabNavigator();

const COLORS = {
  card: '#21242b',
  border: '#2a2d35',
  text: '#e0e0e0',
  textDim: '#8b8d94',
  green: '#4caf93',
};

const LogoutButton = () => {
  const { isLoggedIn, logout } = useAuth();
  if (!isLoggedIn) return null;
  return (
    <TouchableOpacity
      onPress={() =>
        Alert.alert('Выход из SmartShell', 'Вы уверены?', [
          { text: 'Отмена', style: 'cancel' },
          { text: 'Выйти', style: 'destructive', onPress: () => logout() },
        ])
      }
      style={logoutStyles.btn}
    >
      <Text style={logoutStyles.text}>Выйти</Text>
    </TouchableOpacity>
  );
};

const logoutStyles = StyleSheet.create({
  btn: {
    marginRight: 16,
    backgroundColor: '#2a1a1e',
    borderWidth: 1,
    borderColor: '#e0556a',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  text: { color: '#e0556a', fontSize: 12, fontWeight: '600' },
});

export default function App() {
  return (
    <AuthProvider>
      <StatusBar barStyle="light-content" backgroundColor="#1a1d23" />
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: COLORS.card },
            headerTitleStyle: { color: COLORS.text },
            tabBarStyle: { backgroundColor: COLORS.card, borderTopColor: COLORS.border },
            tabBarActiveTintColor: COLORS.green,
            tabBarInactiveTintColor: COLORS.textDim,
            headerRight: () => <LogoutButton />,
          }}
        >
          <Tab.Screen name="Смена" component={ShiftScreen} options={{ headerTitle: 'Сдача смены', tabBarLabel: '📝 Смена' }} />
          <Tab.Screen name="Товар" component={GoodsScreen} options={{ headerTitle: 'Инвентаризация', tabBarLabel: '📦 Товар' }} />
          <Tab.Screen name="Зарплата" component={SalaryScreen} options={{ headerTitle: 'Расчёт зарплаты', tabBarLabel: '💰 Зарплата' }} />
          <Tab.Screen name="История" component={HistoryScreen} options={{ headerTitle: 'История отчётов', tabBarLabel: '📋 История' }} />
          <Tab.Screen name="Настройки" component={SettingsScreen} options={{ headerTitle: 'Настройки', tabBarLabel: '⚙️ Настройки' }} />
        </Tab.Navigator>
      </NavigationContainer>
    </AuthProvider>
  );
}