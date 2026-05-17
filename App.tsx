import React from 'react';
import { StatusBar, TouchableOpacity, Text, StyleSheet, Alert, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItemList } from '@react-navigation/drawer';
import ShiftScreen from './src/screens/ShiftScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import GoodsScreen from './src/screens/GoodsScreen';
import SalaryScreen from './src/screens/SalaryScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import WorkersSettingsScreen from './src/screens/WorkersSettingsScreen';
import { AuthProvider, useAuth } from './src/utils/AuthContext';

const Drawer = createDrawerNavigator();

const COLORS = {
  bg: '#1a1d23',
  card: '#21242b',
  border: '#2a2d35',
  text: '#e0e0e0',
  textDim: '#8b8d94',
  green: '#4caf93',
};

function CustomDrawerContent(props: any) {
  return (
    <DrawerContentScrollView {...props} style={{ backgroundColor: COLORS.bg }}>
      <View style={styles.drawerHeader}>
        <Text style={styles.drawerTitle}>ShiftReport</Text>
        <Text style={styles.drawerSubtitle}>Меню</Text>
      </View>
      <DrawerItemList {...props} />
    </DrawerContentScrollView>
  );
}

const AppDrawer = () => {
  const { userRoles, logout } = useAuth();
  const isManagerOrOwner = userRoles.some(r =>
    r.toLowerCase().includes('manager') || r.toLowerCase().includes('owner') || r.toLowerCase().includes('admin')
  );

  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.card },
        headerTintColor: COLORS.text,
        drawerStyle: { backgroundColor: COLORS.card },
        drawerActiveTintColor: COLORS.green,
        drawerInactiveTintColor: COLORS.textDim,
        drawerLabelStyle: { fontSize: 15 },
        headerRight: () => (
          <TouchableOpacity
            onPress={() =>
              Alert.alert('Выход из SmartShell', 'Вы уверены?', [
                { text: 'Отмена', style: 'cancel' },
                { text: 'Выйти', style: 'destructive', onPress: () => logout() },
              ])
            }
            style={styles.logoutBtn}
          >
            <Text style={styles.logoutText}>Выйти</Text>
          </TouchableOpacity>
        ),
      }}
    >
      <Drawer.Screen name="Смена" component={ShiftScreen} options={{ title: '📝 Сдача смены' }} />
      <Drawer.Screen name="Товар" component={GoodsScreen} options={{ title: '📦 Инвентаризация' }} />
      {isManagerOrOwner && (
        <Drawer.Screen name="Зарплата" component={SalaryScreen} options={{ title: '💰 Расчёт зарплаты' }} />
      )}
      {isManagerOrOwner && (
        <Drawer.Screen name="Сотрудники" component={WorkersSettingsScreen} options={{ title: '👥 Настройки сотрудников' }} />
      )}
      <Drawer.Screen name="История" component={HistoryScreen} options={{ title: '📋 История отчётов' }} />
      <Drawer.Screen name="Настройки" component={SettingsScreen} options={{ title: '⚙️ Настройки' }} />
    </Drawer.Navigator>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <NavigationContainer>
        <AppDrawer />
      </NavigationContainer>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  drawerHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2d35',
    marginBottom: 8,
  },
  drawerTitle: {
    color: '#e0e0e0',
    fontSize: 22,
    fontWeight: '700',
  },
  drawerSubtitle: {
    color: '#8b8d94',
    fontSize: 13,
    marginTop: 4,
  },
  logoutBtn: {
    marginRight: 16,
    backgroundColor: '#2a1a1e',
    borderWidth: 1,
    borderColor: '#e0556a',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  logoutText: {
    color: '#e0556a',
    fontSize: 12,
    fontWeight: '600',
  },
});