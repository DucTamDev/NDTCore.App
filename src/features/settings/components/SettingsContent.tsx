import React from 'react';
import { View, StyleSheet } from 'react-native';
import { PrinterManagementPanel } from '../../printer/components/PrinterManagementPanel';
import { PrintConfigurationPanel } from '../../printer/components/PrintConfigurationPanel';
import { OrderHistoryPanel } from '../../cart/components/OrderHistoryPanel';
import type { SettingsMenuKey } from '../store/settingsSlice';

interface SettingsContentProps {
  activeSection: SettingsMenuKey | null;
}

export const SettingsContent: React.FC<SettingsContentProps> = ({ activeSection }) => (
  <View style={styles.container}>
    {activeSection === 'printer' && <PrinterManagementPanel />}
    {activeSection === 'printConfiguration' && <PrintConfigurationPanel />}
    {activeSection === 'orderHistory' && <OrderHistoryPanel />}
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
});
