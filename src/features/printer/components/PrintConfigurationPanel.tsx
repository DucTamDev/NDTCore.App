import React, { useCallback, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { AppSwitch } from '../../../components/AppSwitch';
import { PrinterService } from '../services/PrinterService';
import { PrintConfigurationService } from '../services/PrintConfigurationService';
import { generateId } from '../../../utils/id';
import type { PrintConfiguration, PrintType } from '../types/printConfiguration.types';

const PRINT_TYPE_SECTIONS: { printType: PrintType; label: string }[] = [
  { printType: 'Receipt', label: 'Hoá đơn' },
  { printType: 'Label', label: 'Tem' },
];

export const PrintConfigurationPanel: React.FC = () => {
  const [configurations, setConfigurations] = useState<PrintConfiguration[]>(() => PrintConfigurationService.getAll());
  const printers = PrinterService.getPrinters();

  const refresh = useCallback(() => setConfigurations(PrintConfigurationService.getAll()), []);

  const toggle = (printType: PrintType, printerId: string, checked: boolean): void => {
    const existing = configurations.find((c) => c.printType === printType && c.printerId === printerId);
    if (checked) {
      PrintConfigurationService.upsert({
        id: existing?.id ?? generateId(),
        printType,
        printerId,
        isDefault: true,
        isEnabled: true,
      });
    } else if (existing) {
      PrintConfigurationService.remove(existing.id);
    }
    refresh();
  };

  return (
    <View style={styles.container}>
      <Text variant="titleSmall">Thiết lập in</Text>
      {PRINT_TYPE_SECTIONS.map((section) => (
        <View key={section.printType} style={styles.section}>
          <Text variant="titleSmall">{section.label}</Text>
          {printers.map((printer) => {
            const checked = configurations.some(
              (c) => c.printType === section.printType && c.printerId === printer.id,
            );
            return (
              <AppSwitch
                key={printer.id}
                label={printer.printerName}
                value={checked}
                onValueChange={(value) => toggle(section.printType, printer.id, value)}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  section: { gap: 8 },
});
