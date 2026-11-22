import React from 'react';
import { StatusBar, TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItemList } from '@react-navigation/drawer';
import ShiftScreen from './src/screens/ShiftScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import GoodsScreen from './src/screens/GoodsScreen';
import SalaryScreen from './src/screens/SalaryScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import WorkersSettingsScreen from './src/screens/WorkersSettingsScreen';
import { AuthProvider, useAuth } from './src/utils/AuthContext';
import DashboardScreen from './src/screens/DashboardScreen';
import EditReportScreen from './src/screens/EditReportScreen';
import { COLORS } from './src/theme';

const Drawer = createDrawerNavigator();

function CustomDrawerContent(props: any) {
  return (
    <DrawerContentScrollView {...props} style={{ backgroundColor: COLORS.bg }}>
      <View style={styles.drawerHeader}>
        <Text style={styles.drawerMark}>SR / 01</Text>
        <Text style={styles.drawerTitle}>SHIFT REPORT</Text>
        <Text style={styles.drawerSubtitle}>Рабочая система</Text>
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
        headerStyle: { backgroundColor: COLORS.bg, borderBottomWidth: 1, borderBottomColor: COLORS.border },
        headerShadowVisible: false,
        headerTintColor: COLORS.text,
        headerTitleStyle: { fontSize: 14, fontWeight: '700', letterSpacing: 0.4 },
        drawerStyle: { backgroundColor: COLORS.bg, borderRightColor: COLORS.border, borderRightWidth: 1 },
        drawerActiveBackgroundColor: COLORS.greenBg,
        drawerActiveTintColor: COLORS.green,
        drawerInactiveTintColor: COLORS.textDim,
        drawerLabelStyle: { fontSize: 14, fontWeight: '600' },
        headerRight: () => (
          <TouchableOpacity
            onPress={() => logout()}
            style={styles.logoutBtn}
          >
            <Text style={styles.logoutText}>Выйти</Text>
          </TouchableOpacity>
        ),
      }}
    >
      <Drawer.Screen name="Дашборд" component={DashboardScreen} options={{ title: 'Dashboard', headerShown: false }} />
      <Drawer.Screen name="Смена" component={ShiftScreen} options={{ title: 'Сдача смены' }} />
      <Drawer.Screen name="Товар" component={GoodsScreen} options={{ title: 'Инвентаризация' }} />
      {isManagerOrOwner && (
        <Drawer.Screen name="Зарплата" component={SalaryScreen} options={{ title: 'Расчёт зарплаты' }} />
      )}
      {isManagerOrOwner && (
        <Drawer.Screen name="Сотрудники" component={WorkersSettingsScreen} options={{ title: 'Сотрудники' }} />
      )}
      <Drawer.Screen name="История" component={HistoryScreen} options={{ title: 'История отчётов' }} />
      <Drawer.Screen name="Настройки" component={SettingsScreen} options={{ title: 'Настройки' }} />
      <Drawer.Screen name="EditReport" component={EditReportScreen} options={{ title: 'Редактирование отчёта', drawerItemStyle: { display: 'none' } }} />
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
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 22,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 12,
  },
  drawerMark: { color: COLORS.green, fontSize: 10, fontWeight: '800', letterSpacing: 2, marginBottom: 16 },
  drawerTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  drawerSubtitle: {
    color: COLORS.textDim,
    fontSize: 11,
    marginTop: 5,
  },
  logoutBtn: {
    marginRight: 16,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#e0556a',
    borderRadius: 0,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  logoutText: {
    color: '#e0556a',
    fontSize: 12,
    fontWeight: '600',
  },
});
