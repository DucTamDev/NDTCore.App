import React from 'react';
import { View, StyleSheet } from 'react-native';
import { PrinterManagementPanel } from '../../printer/components/PrinterManagementPanel';
import { PrintDestinationPanel } from '../../printer/components/PrintDestinationPanel';
import type { SettingsMenuKey } from '../store/settingsSlice';

interface SettingsContentProps {
  activeSection: SettingsMenuKey | null;
}

export const SettingsContent: React.FC<SettingsContentProps> = ({ activeSection }) => (
  <View style={styles.container}>
    {activeSection === 'printer' && <PrinterManagementPanel />}
    {activeSection === 'printDestination' && <PrintDestinationPanel />}
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
});
