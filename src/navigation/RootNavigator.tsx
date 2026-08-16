// src/navigation/RootNavigator.tsx
import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Icon } from 'react-native-paper';
import { SettingsScreen } from '../features/settings/screens/SettingsScreen';
import { SalesScreen } from '../features/sales/screens/SalesScreen';
import { LoginScreen } from '../features/auth/screens/LoginScreen';
import { StoreSelectScreen } from '../features/store/screens/StoreSelectScreen';
import { selectIsLoggedIn, loggedOut } from '../features/auth/store/authSlice';
import { selectCurrentStoreId } from '../features/store/store/storeSlice';
import { StoreService } from '../features/store/services/StoreService';
import { onSessionExpired } from '../services/http/sessionEvents';
import type { AppDispatch, RootState } from '../store';
import type { AuthStackParamList, RootTabParamList, StoreSelectStackParamList } from './types';

const Tab = createBottomTabNavigator<RootTabParamList>();

const SalesTabIcon = ({ color, size }: { color: string; size: number }) => (
  <Icon source="point-of-sale" color={color} size={size} />
);

const SettingsTabIcon = ({ color, size }: { color: string; size: number }) => (
  <Icon source="cog" color={color} size={size} />
);

const AppTabs: React.FC = () => (
  <Tab.Navigator initialRouteName="Sales" screenOptions={{ headerShown: false }}>
    <Tab.Screen
      name="Sales"
      component={SalesScreen}
      options={{
        title: 'Bán hàng',
        tabBarIcon: SalesTabIcon,
      }}
    />
    <Tab.Screen
      name="Settings"
      component={SettingsScreen}
      options={{
        title: 'Ứng dụng',
        tabBarIcon: SettingsTabIcon,
      }}
    />
  </Tab.Navigator>
);

const AuthNativeStack = createNativeStackNavigator<AuthStackParamList>();

const AuthStack: React.FC = () => (
  <AuthNativeStack.Navigator screenOptions={{ headerShown: false }}>
    <AuthNativeStack.Screen name="Login" component={LoginScreen} />
  </AuthNativeStack.Navigator>
);

const StoreSelectNativeStack = createNativeStackNavigator<StoreSelectStackParamList>();

const StoreSelectStack: React.FC = () => (
  <StoreSelectNativeStack.Navigator screenOptions={{ headerShown: false }}>
    <StoreSelectNativeStack.Screen name="StoreSelect" component={StoreSelectScreen} />
  </StoreSelectNativeStack.Navigator>
);

export const RootNavigator: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const isLoggedIn = useSelector((state: RootState) => selectIsLoggedIn(state));
  const storeId = useSelector((state: RootState) => selectCurrentStoreId(state));

  useEffect(
    () =>
      onSessionExpired(() => {
        StoreService.clearStoreId();
        dispatch(loggedOut());
      }),
    [dispatch],
  );

  let content: React.ReactElement;
  if (!isLoggedIn) {
    content = <AuthStack />;
  } else if (!storeId) {
    content = <StoreSelectStack />;
  } else {
    content = <AppTabs />;
  }

  return <NavigationContainer>{content}</NavigationContainer>;
};
