import React from 'react';
import { View, StyleSheet } from 'react-native';
import { PrinterManagementPanel } from '../../printer/components/PrinterManagementPanel';
import { OrderHistoryPanel } from '../../cart/components/OrderHistoryPanel';
import type { ApplicationMenuKey } from '../store/applicationSlice';

interface ApplicationContentProps {
  activeSection: ApplicationMenuKey | null;
}

export const ApplicationContent: React.FC<ApplicationContentProps> = ({ activeSection }) => (
  <View style={styles.container}>
    {activeSection === 'printer' && <PrinterManagementPanel />}
    {activeSection === 'orderHistory' && <OrderHistoryPanel />}
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
});
