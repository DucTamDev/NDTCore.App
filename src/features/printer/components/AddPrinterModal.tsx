// src/features/printer/components/AddPrinterModal.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Modal, Portal, Text, SegmentedButtons } from 'react-native-paper';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AppInput } from '../../../components/AppInput';
import { AppButton } from '../../../components/AppButton';
import { LoadingOverlay } from '../../../components/LoadingOverlay';
import { PrinterService } from '../services/PrinterService';
import { generateId } from '../../../utils/id';
import {
  lanConnectionSchema,
  printerDisplaySchema,
  type LanConnectionValues,
  type PrinterDisplayValues,
} from '../schemas/printerFormSchema';
import { DeviceScanList } from './DeviceScanList';
import { PrinterInfoCard } from './PrinterInfoCard';
import type { DiscoveryEvent } from '../services/discoverProtocol';
import type { AppError } from '../../../types/AppError';
import type {
  ConnectionType,
  PrinterConfig,
  PrinterDevice,
  PrinterDeviceInfo,
  PrinterStatus,
  Protocol,
  ProtocolSource,
} from '../types/printer.types';

export interface AddPrinterModalProps {
  visible: boolean;
  initialValues?: PrinterConfig;
  onDismiss: () => void;
  onSaved: () => void;
}

type WizardStep =
  | { name: 'selectConnection' }
  | { name: 'selectDevice' }
  | { name: 'connecting' }
  | { name: 'chooseProtocol' }
  | { name: 'identified'; protocol: Protocol; protocolSource: ProtocolSource; deviceInfo?: PrinterDeviceInfo }
  | { name: 'error'; error: AppError };

const protocolChoices: Array<{ value: Protocol; label: string }> = [
  { value: 'escpos', label: 'ESC/POS' },
  { value: 'tspl', label: 'TSPL' },
];

export const AddPrinterModal: React.FC<AddPrinterModalProps> = ({ visible, initialValues, onDismiss, onSaved }) => {
  const printerId = useMemo(() => initialValues?.id ?? generateId(), [initialValues?.id]);
  const [connectionType, setConnectionType] = useState<ConnectionType>(initialValues?.connectionType ?? 'usb');
  const [selectedDevice, setSelectedDevice] = useState<PrinterDevice | undefined>(initialValues?.device);
  const [autoReconnect, setAutoReconnect] = useState(initialValues?.autoReconnect ?? true);
  const [canTestPrint, setCanTestPrint] = useState(Boolean(initialValues));
  const [testPrintPending, setTestPrintPending] = useState(false);
  const [liveStatus, setLiveStatus] = useState<PrinterStatus>('idle');
  const [connectionDirty, setConnectionDirty] = useState(!initialValues);
  const discoveryUnsubscribeRef = useRef<(() => void) | null>(null);
  const savedRef = useRef(false);

  const [step, setStep] = useState<WizardStep>(
    initialValues
      ? {
          name: 'identified',
          protocol: initialValues.protocol,
          protocolSource: initialValues.protocolSource,
          deviceInfo: initialValues.deviceInfo,
        }
      : { name: 'selectConnection' },
  );

  const lanForm = useForm<LanConnectionValues>({
    resolver: zodResolver(lanConnectionSchema),
    defaultValues: {
      lanIp: initialValues?.lan?.ip ?? '',
      lanPort: initialValues?.lan?.port ? String(initialValues.lan.port) : '',
    },
  });

  const displayForm = useForm<PrinterDisplayValues>({
    resolver: zodResolver(printerDisplaySchema),
    defaultValues: {
      printerName: initialValues?.printerName ?? '',
      paperSize: initialValues?.paperSize ?? '80mm',
    },
  });

  useEffect(() => {
    if (step.name !== 'identified') return undefined;
    setLiveStatus(PrinterService.getStatusForProtocol(step.protocol, printerId));
    return PrinterService.onStatusChangeForProtocol(step.protocol, printerId, setLiveStatus);
  }, [step, printerId]);

  useEffect(() => {
    if (!visible) {
      discoveryUnsubscribeRef.current?.();
      discoveryUnsubscribeRef.current = null;
      if (step.name === 'identified' && !savedRef.current) {
        PrinterService.disconnectForProtocol(step.protocol, printerId).catch(() => undefined);
      }
    }
    return () => {
      discoveryUnsubscribeRef.current?.();
    };
  }, [visible, step, printerId]);

  const buildLan = (values: LanConnectionValues) => ({ ip: values.lanIp, port: Number(values.lanPort) });

  const startDiscovery = (lan?: { ip: string; port: number }): void => {
    setCanTestPrint(false);
    setConnectionDirty(true);
    setStep({ name: 'connecting' });
    discoveryUnsubscribeRef.current = PrinterService.discoverProtocol(
      {
        printerId,
        connectionType,
        device: connectionType === 'lan' ? undefined : selectedDevice,
        lan,
      },
      (event: DiscoveryEvent) => {
        if (event.stage === 'identified' && event.protocol) {
          setStep({ name: 'identified', protocol: event.protocol, protocolSource: 'auto', deviceInfo: event.deviceInfo });
          if (!displayForm.getValues('printerName')) {
            displayForm.setValue(
              'printerName',
              event.deviceInfo?.deviceName ?? selectedDevice?.displayName ?? 'Máy in mới',
            );
          }
        } else if (event.stage === 'unknown_protocol') {
          setStep({ name: 'chooseProtocol' });
        } else if (event.stage === 'error' && event.error) {
          setStep({ name: 'error', error: event.error });
        }
      },
    );
  };

  const onConnectPress = (): void => {
    if (connectionType === 'lan') {
      lanForm.handleSubmit((values) => startDiscovery(buildLan(values)))();
    } else {
      startDiscovery(undefined);
    }
  };

  const onChooseProtocol = (protocol: Protocol): void => {
    setStep({ name: 'connecting' });
    const config: PrinterConfig = {
      id: printerId,
      printerName: 'Máy in mới',
      protocol,
      protocolSource: 'manual',
      connectionType,
      paperSize: '80mm',
      autoReconnect: false,
      isDefault: false,
      device: connectionType === 'lan' ? undefined : selectedDevice,
      lan: connectionType === 'lan' ? buildLan(lanForm.getValues()) : undefined,
    };
    PrinterService.connectDraft(config)
      .then(() => setStep({ name: 'identified', protocol, protocolSource: 'manual', deviceInfo: undefined }))
      .catch((error: AppError) => setStep({ name: 'error', error }));
  };

  const buildFinalConfig = (protocol: Protocol, protocolSource: ProtocolSource, deviceInfo?: PrinterDeviceInfo): PrinterConfig => {
    const display = displayForm.getValues();
    return {
      id: printerId,
      printerName: display.printerName,
      protocol,
      protocolSource,
      connectionType,
      paperSize: display.paperSize,
      autoReconnect,
      isDefault: initialValues?.isDefault ?? false,
      device: connectionType === 'lan' ? undefined : selectedDevice,
      lan: connectionType === 'lan' ? buildLan(lanForm.getValues()) : undefined,
      deviceInfo,
    };
  };

  const onTestPrint = async (): Promise<void> => {
    if (step.name !== 'identified') return;
    const valid = await displayForm.trigger();
    if (!valid) return;
    setTestPrintPending(true);
    try {
      await PrinterService.testPrint(buildFinalConfig(step.protocol, step.protocolSource, step.deviceInfo));
      setCanTestPrint(true);
    } catch {
      setCanTestPrint(false);
    } finally {
      setTestPrintPending(false);
    }
  };

  const onSave = displayForm.handleSubmit(() => {
    if (step.name !== 'identified' || !canTestPrint) return;
    savedRef.current = true;
    const config = buildFinalConfig(step.protocol, step.protocolSource, step.deviceInfo);
    if (initialValues) PrinterService.updatePrinter(config);
    else PrinterService.addPrinter(config);
    if (config.autoReconnect && liveStatus !== 'connected') {
      PrinterService.connect(config.id).catch(() => undefined);
    }
    onSaved();
  });

  const onChangeConnection = (): void => {
    setStep({ name: 'selectConnection' });
    setSelectedDevice(undefined);
    setCanTestPrint(false);
    setConnectionDirty(true);
  };

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.container}>
        <Text variant="titleMedium">{initialValues ? 'Chỉnh sửa máy in' : 'Thêm máy in'}</Text>

        {step.name === 'selectConnection' && (
          <View style={styles.stepGap}>
            <SegmentedButtons
              value={connectionType}
              onValueChange={(value) => setConnectionType(value as ConnectionType)}
              buttons={[
                { value: 'usb', label: 'USB' },
                { value: 'bluetooth', label: 'Bluetooth' },
                { value: 'lan', label: 'LAN' },
              ]}
            />
            <AppButton label="Tiếp tục" onPress={() => setStep({ name: 'selectDevice' })} />
          </View>
        )}

        {step.name === 'selectDevice' && (
          <View style={styles.stepGap}>
            {connectionType === 'lan' ? (
              <>
                <AppInput
                  label="Địa chỉ IP"
                  value={lanForm.watch('lanIp')}
                  onChangeText={(text) => lanForm.setValue('lanIp', text)}
                  errorMessage={lanForm.formState.errors.lanIp?.message}
                />
                <AppInput
                  label="Cổng"
                  value={lanForm.watch('lanPort')}
                  onChangeText={(text) => lanForm.setValue('lanPort', text)}
                  keyboardType="numeric"
                  errorMessage={lanForm.formState.errors.lanPort?.message}
                />
              </>
            ) : (
              <DeviceScanList
                connectionType={connectionType}
                selectedDeviceId={selectedDevice?.deviceId}
                onSelect={setSelectedDevice}
              />
            )}
            <AppButton
              label="Kết nối"
              onPress={onConnectPress}
              disabled={connectionType !== 'lan' && !selectedDevice}
            />
          </View>
        )}

        {step.name === 'connecting' && (
          <View style={styles.stepGap}>
            <LoadingOverlay />
            <Text variant="bodyMedium">Đang kết nối và nhận diện máy in...</Text>
          </View>
        )}

        {step.name === 'chooseProtocol' && (
          <View style={styles.stepGap}>
            <Text variant="bodyMedium">Không thể tự nhận diện giao thức. Vui lòng chọn thủ công:</Text>
            <SegmentedButtons
              value=""
              onValueChange={(value) => onChooseProtocol(value as Protocol)}
              buttons={protocolChoices}
            />
          </View>
        )}

        {step.name === 'error' && (
          <View style={styles.stepGap}>
            <Text variant="bodyMedium">{step.error.message}</Text>
            <AppButton label="Thử lại" onPress={() => setStep({ name: 'selectDevice' })} />
          </View>
        )}

        {step.name === 'identified' && (
          <View style={styles.stepGap}>
            <PrinterInfoCard
              control={displayForm.control}
              errors={displayForm.formState.errors}
              connectionType={connectionType}
              protocol={step.protocol}
              protocolSource={step.protocolSource}
              deviceInfo={step.deviceInfo}
              status={liveStatus}
              autoReconnect={autoReconnect}
              onAutoReconnectChange={setAutoReconnect}
              canTestPrint={canTestPrint}
              testPrintPending={testPrintPending}
              onTestPrint={onTestPrint}
              onSave={onSave}
              saveDisabled={connectionDirty && liveStatus !== 'connected'}
            />
            <AppButton label="Đổi kết nối" mode="outlined" onPress={onChangeConnection} />
          </View>
        )}
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  container: { backgroundColor: 'white', margin: 24, padding: 16, borderRadius: 16, gap: 12 },
  stepGap: { gap: 12 },
});
