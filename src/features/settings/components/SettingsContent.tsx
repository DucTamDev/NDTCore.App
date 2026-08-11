import React from 'react';
import { View, StyleSheet } from 'react-native';
import { PrinterManagementPanel } from '../../printer/components/PrinterManagementPanel';
import type { SettingsMenuKey } from '../store/settingsSlice';

interface SettingsContentProps {
  activeSection: SettingsMenuKey | null;
}

export const SettingsContent: React.FC<SettingsContentProps> = ({ activeSection }) => (
  <View style={styles.container}>
    {activeSection === 'printer' && <PrinterManagementPanel />}
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
});
