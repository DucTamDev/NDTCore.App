import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, TouchableRipple, Icon, useTheme } from 'react-native-paper';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '../../../store';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { usePrinterList } from '../../printer/hooks/usePrinterList';
import { PrinterConnectionService } from '../../printer/services/PrinterConnectionService';
import { PrinterStatus } from '../../printer/models/printer/PrinterStatus';
import { useAuth } from '../../auth/hooks/useAuth';
import { StoreService } from '../../store/services/StoreService';
import { storeCleared } from '../../store/store/storeSlice';
import { applicationMenuItems, type ApplicationMenuItem } from '../config/applicationConfig';
import type { ApplicationMenuKey } from '../store/applicationSlice';
import { ApplicationSidebarItem } from './ApplicationSidebarItem';

interface ApplicationSidebarProps {
  activeSection: ApplicationMenuKey | null;
  onSelectSection: (section: ApplicationMenuKey) => void;
  isTablet: boolean;
}

export const ApplicationSidebar: React.FC<ApplicationSidebarProps> = ({
  activeSection,
  onSelectSection,
  isTablet,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const { printers } = usePrinterList();
  const hasConnectedPrinter = printers.some((p) => PrinterConnectionService.getStatus(p.id) === PrinterStatus.connected);
  const { logout } = useAuth();
  const [confirmLogoutVisible, setConfirmLogoutVisible] = useState(false);
  const [confirmChangeStoreVisible, setConfirmChangeStoreVisible] = useState(false);
  const theme = useTheme();

  const confirmLogout = (): void => {
    setConfirmLogoutVisible(false);
    logout();
  };

  const confirmChangeStore = (): void => {
    setConfirmChangeStoreVisible(false);
    StoreService.clearStoreId();
    dispatch(storeCleared());
  };

  const renderItem = (item: ApplicationMenuItem) => (
    <ApplicationSidebarItem
      key={item.key}
      item={item}
      isActive={activeSection === item.key}
      isTablet={isTablet}
      hasConnectedPrinter={hasConnectedPrinter}
      onPress={() => onSelectSection(item.key)}
    />
  );

  return (
    <View
      style={[
        styles.container,
        isTablet
          ? [styles.sidebarTablet, { borderRightColor: theme.colors.outlineVariant }]
          : styles.sidebarPhone,
      ]}
    >
      <Text style={[styles.groupLabel, { color: theme.colors.outline }]}>Thiết bị</Text>
      {applicationMenuItems.filter((item) => item.group === 'device').map(renderItem)}

      <Text style={[styles.groupLabel, { color: theme.colors.outline }]}>Ứng dụng</Text>
      {applicationMenuItems.filter((item) => item.group === 'app').map(renderItem)}

      <View style={styles.spacer} />
      <TouchableRipple style={styles.item} onPress={() => setConfirmChangeStoreVisible(true)}>
        <View style={styles.itemRow}>
          <Icon source="store-outline" size={16} color={theme.colors.onSurface} />
          <Text style={[styles.itemLabel, { color: theme.colors.onSurface }]}>Đổi cửa hàng</Text>
        </View>
      </TouchableRipple>
      <TouchableRipple style={styles.item} onPress={() => setConfirmLogoutVisible(true)}>
        <View style={styles.itemRow}>
          <Icon source="logout" size={16} color={theme.colors.onSurface} />
          <Text style={[styles.itemLabel, { color: theme.colors.onSurface }]}>Đăng xuất</Text>
        </View>
      </TouchableRipple>

      <ConfirmDialog
        visible={confirmChangeStoreVisible}
        title="Đổi cửa hàng"
        message="Quay lại màn chọn cửa hàng?"
        confirmLabel="Đổi cửa hàng"
        onConfirm={confirmChangeStore}
        onCancel={() => setConfirmChangeStoreVisible(false)}
      />
      <ConfirmDialog
        visible={confirmLogoutVisible}
        title="Đăng xuất"
        message="Bạn có chắc muốn đăng xuất không?"
        confirmLabel="Đăng xuất"
        onConfirm={confirmLogout}
        onCancel={() => setConfirmLogoutVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 8 },
  sidebarTablet: { width: 220, borderRightWidth: StyleSheet.hairlineWidth },
  sidebarPhone: { flex: 1 },
  groupLabel: { fontSize: 11, marginTop: 8, marginBottom: 4, marginLeft: 6 },
  item: { paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemLabel: { fontSize: 13, flex: 1 },
  spacer: { flex: 1 },
});
