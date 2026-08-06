// src/navigation/RootNavigator.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Icon } from 'react-native-paper';
import { SettingsScreen } from '../features/settings/screens/SettingsScreen';
import { SalesScreen } from '../features/sales/screens/SalesScreen';
import type { RootTabParamList } from './types';

const Tab = createBottomTabNavigator<RootTabParamList>();

const SalesTabIcon = ({ color, size }: { color: string; size: number }) => (
  <Icon source="point-of-sale" color={color} size={size} />
);

const SettingsTabIcon = ({ color, size }: { color: string; size: number }) => (
  <Icon source="cog" color={color} size={size} />
);

export const RootNavigator: React.FC = () => (
  <NavigationContainer>
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
  </NavigationContainer>
);
