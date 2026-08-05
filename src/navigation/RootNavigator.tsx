// src/navigation/RootNavigator.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Icon } from 'react-native-paper';
import { SettingsScreen } from '../features/settings/screens/SettingsScreen';
import { SalesScreen } from '../features/sales/screens/SalesScreen';

export type RootTabParamList = {
  Sales: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

export const RootNavigator: React.FC = () => (
  <NavigationContainer>
    <Tab.Navigator initialRouteName="Sales" screenOptions={{ headerShown: false }}>
      <Tab.Screen
        name="Sales"
        component={SalesScreen}
        options={{
          title: 'Bán hàng',
          tabBarIcon: ({ color, size }) => <Icon source="point-of-sale" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Cài đặt',
          tabBarIcon: ({ color, size }) => <Icon source="cog" color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  </NavigationContainer>
);
