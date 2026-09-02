import React, { useState, useEffect } from 'react';
import { View, StyleSheet, BackHandler } from 'react-native';
import { Text } from 'react-native-paper';
import { AppButton } from '../../../components/AppButton';
import { useLayoutMode } from '../../../hooks/useLayoutMode';
import { usePrinterList } from '../hooks/usePrinterList';
import { PrinterList } from './PrinterList';
import { AddPrinterModal } from './AddPrinterModal';
import { AddPrinterForm } from './AddPrinterForm';
import type { Printer } from '../models/printer/Printer';

export const PrinterManagementPanel: React.FC = () => {
  const { printers, reload, ...actions } = usePrinterList();
  const [mode, setMode] = useState<'list' | 'form'>('list');
  const [editingPrinter, setEditingPrinter] = useState<Printer | undefined>(undefined);
  const [addSessionId, setAddSessionId] = useState(0);
  const isPhone = useLayoutMode() === 'phone';

  const openAdd = (): void => {
    setAddSessionId((n) => n + 1);
    setEditingPrinter(undefined);
    setMode('form');
  };

  const openEdit = (printer: Printer): void => {
    setEditingPrinter(printer);
    setMode('form');
  };

  const backToList = (): void => setMode('list');

  const onSaved = (): void => {
    setMode('list');
    reload();
  };

  useEffect(() => {
    if (!(isPhone && mode === 'form')) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setMode('list');
      return true;
    });
    return () => sub.remove();
  }, [isPhone, mode]);

  const formKey = editingPrinter?.id ?? `add-${addSessionId}`;

  if (isPhone && mode === 'form') {
    return (
      <View style={styles.phoneForm}>
        <AddPrinterForm
          key={formKey}
          visible
          initialValues={editingPrinter}
          onSaved={onSaved}
          onBack={backToList}
          showBackButton={false}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="titleSmall">Thiết lập máy in</Text>
        <AppButton label="Thêm máy in" onPress={openAdd} />
      </View>

      <PrinterList printers={printers} actions={actions} onEdit={openEdit} />

      {!isPhone && (
        <AddPrinterModal
          key={formKey}
          visible={mode === 'form'}
          initialValues={editingPrinter}
          onDismiss={backToList}
          onSaved={onSaved}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  phoneForm: { flex: 1, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
