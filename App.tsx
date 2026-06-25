import React from 'react';
import { StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerItemList,
} from '@react-navigation/drawer';
import DashboardScreen from './src/screens/DashboardScreen';
import EditReportScreen from './src/screens/EditReportScreen';
import GoodsScreen from './src/screens/GoodsScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import SalaryScreen from './src/screens/SalaryScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import ShiftScreen from './src/screens/ShiftScreen';
import WorkersSettingsScreen from './src/screens/WorkersSettingsScreen';
import { useResponsiveLayout } from './src/ui/layout';
import { COLORS } from './src/ui/theme';
import { AuthProvider, useAuth } from './src/utils/AuthContext';

const Drawer = createDrawerNavigator();

function CustomDrawerContent(props: any) {
  return (
    <DrawerContentScrollView
      {...props}
      style={styles.drawerScroll}
      contentContainerStyle={styles.drawerContent}
    >
      <View style={styles.drawerHeader}>
        <Text style={styles.drawerEyebrow}>ShiftReport</Text>
        <Text style={styles.drawerTitle}>Операционная панель</Text>
        <Text style={styles.drawerSubtitle}>
          Смены, инвентаризация, история и зарплата в одном рабочем пространстве.
        </Text>
      </View>
      <DrawerItemList {...props} />
    </DrawerContentScrollView>
  );
}

function AppDrawer() {
  const { isDesktop } = useResponsiveLayout();
  const { userRoles, logout } = useAuth();
  const isManagerOrOwner = userRoles.some((role) => {
    const normalized = role.toLowerCase();
    return normalized.includes('manager') || normalized.includes('owner') || normalized.includes('admin');
  });

  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      defaultStatus={isDesktop ? 'open' : 'closed'}
      screenOptions={{
        drawerType: isDesktop ? 'permanent' : 'front',
        overlayColor: 'transparent',
        sceneStyle: { backgroundColor: COLORS.background },
        headerStyle: { backgroundColor: COLORS.backgroundAlt },
        headerTintColor: COLORS.text,
        headerShadowVisible: false,
        drawerStyle: [styles.drawer, isDesktop && styles.drawerDesktop],
        drawerActiveTintColor: COLORS.text,
        drawerInactiveTintColor: COLORS.textMuted,
        drawerActiveBackgroundColor: COLORS.surfaceStrong,
        drawerItemStyle: styles.drawerItem,
        drawerLabelStyle: styles.drawerLabel,
        headerRight: () => (
          <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Выйти</Text>
          </TouchableOpacity>
        ),
      }}
    >
      <Drawer.Screen
        name="Дашборд"
        component={DashboardScreen}
        options={{ title: 'Аналитика смен' }}
      />
      <Drawer.Screen
        name="Смена"
        component={ShiftScreen}
        options={{ title: 'Сдача смены' }}
      />
      <Drawer.Screen
        name="Товар"
        component={GoodsScreen}
        options={{ title: 'Инвентаризация' }}
      />
      {isManagerOrOwner ? (
        <Drawer.Screen
          name="Зарплата"
          component={SalaryScreen}
          options={{ title: 'Расчет зарплаты' }}
        />
      ) : null}
      {isManagerOrOwner ? (
        <Drawer.Screen
          name="Сотрудники"
          component={WorkersSettingsScreen}
          options={{ title: 'Настройки сотрудников' }}
        />
      ) : null}
      <Drawer.Screen
        name="История"
        component={HistoryScreen}
        options={{ title: 'История отчетов' }}
      />
      <Drawer.Screen
        name="Настройки"
        component={SettingsScreen}
        options={{ title: 'Настройки отображения' }}
      />
      <Drawer.Screen
        name="EditReport"
        component={EditReportScreen}
        options={{
          title: 'Редактирование отчета',
          drawerItemStyle: { display: 'none' },
        }}
      />
    </Drawer.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <NavigationContainer>
        <AppDrawer />
      </NavigationContainer>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  drawerScroll: {
    backgroundColor: COLORS.backgroundAlt,
  },
  drawerContent: {
    paddingTop: 8,
    paddingBottom: 20,
  },
  drawer: {
    backgroundColor: COLORS.backgroundAlt,
    borderRightWidth: 1,
    borderRightColor: COLORS.borderSoft,
    width: 300,
  },
  drawerDesktop: {
    width: 320,
  },
  drawerHeader: {
    margin: 16,
    padding: 18,
    borderRadius: 24,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },
  drawerEyebrow: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    marginBottom: 8,
  },
  drawerTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '800',
  },
  drawerSubtitle: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },
  drawerItem: {
    marginHorizontal: 12,
    borderRadius: 14,
  },
  drawerLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  logoutBtn: {
    marginRight: 16,
    backgroundColor: 'rgba(255, 127, 150, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 127, 150, 0.28)',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  logoutText: {
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: '700',
  },
});
