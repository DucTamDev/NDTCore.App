import React from 'react';
import { View, StyleSheet } from 'react-native';
import { PrinterManagementPanel } from '../../printer/components/PrinterManagementPanel';
import { PrintDestinationPanel } from '../../printer/components/PrintDestinationPanel';
import { PrintRoutingPanel } from '../../printer/components/PrintRoutingPanel';
import type { SettingsMenuKey } from '../store/settingsSlice';

interface SettingsContentProps {
  activeSection: SettingsMenuKey | null;
}

export const SettingsContent: React.FC<SettingsContentProps> = ({ activeSection }) => (
  <View style={styles.container}>
    {activeSection === 'printer' && <PrinterManagementPanel />}
    {activeSection === 'printDestination' && <PrintDestinationPanel />}
    {activeSection === 'printRouting' && <PrintRoutingPanel />}
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
});
