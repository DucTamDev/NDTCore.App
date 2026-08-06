// src/navigation/RootNavigator.tsx
import React from 'react';
import { useSelector } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Icon } from 'react-native-paper';
import { SettingsScreen } from '../features/settings/screens/SettingsScreen';
import { SalesScreen } from '../features/sales/screens/SalesScreen';
import { LoginScreen } from '../features/auth/screens/LoginScreen';
import { selectIsLoggedIn } from '../features/auth/store/authSlice';
import type { RootState } from '../store';
import type { RootTabParamList } from './types';

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
        title: 'Cài đặt',
        tabBarIcon: SettingsTabIcon,
      }}
    />
  </Tab.Navigator>
);

type AuthStackParamList = {
  Login: undefined;
};

const AuthNativeStack = createNativeStackNavigator<AuthStackParamList>();

const AuthStack: React.FC = () => (
  <AuthNativeStack.Navigator screenOptions={{ headerShown: false }}>
    <AuthNativeStack.Screen name="Login" component={LoginScreen} />
  </AuthNativeStack.Navigator>
);

export const RootNavigator: React.FC = () => {
  const isLoggedIn = useSelector((state: RootState) => selectIsLoggedIn(state));

  return <NavigationContainer>{isLoggedIn ? <AppTabs /> : <AuthStack />}</NavigationContainer>;
};
