// src/features/printer/components/AddPrinterModal.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Modal, Portal, Snackbar, Text } from 'react-native-paper';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PrinterService } from '../printing/PrinterService';
import { DEFAULT_TSPL_FONT } from '../drivers/tspl/TsplFontManager';
import { getCurrentWifiIp } from '../services/NetworkInfoService';
import { buildSampleReceiptDocument, buildSampleLabelDocument } from '../utils/sampleDocuments';
import { useBillImageCapture } from '../hooks/useBillImageCapture';
import { generateId } from '../../../utils/id';
import { resolveIdentityKey } from '../discovery/PrinterResolver';
import { getDriverDefinition } from '../definitions/PrinterDriverDefinitions';
import {
  lanConnectionSchema,
  printerDisplaySchema,
  type LanConnectionValues,
  type PrinterDisplayValues,
} from '../schemas/printerFormSchema';
import { ConnectionSection } from './ConnectionSection';
import { StatusPanel, type ConnectionState, type ProtocolState } from './StatusPanel';
import { PrinterInfoCard } from './PrinterInfoCard';
import type { DiscoveryEvent } from '../discovery/PrinterDiscoveryService';
import { AppErrorException } from '../types/AppError';
import type { PrintDocumentVariants } from '../types/driver.types';
import { PrintType } from '../types/printConfiguration.types';
import { ConnectionType, DriverSource, isTsplTrueTypeActive, PrinterDriverType, PrinterStatus, TsplRenderMode } from '../types/printer.types';
import type {
  Printer,
  PrinterDevice,
  PrinterDeviceInfo,
  PrinterDriver,
} from '../types/printer.types';

export interface AddPrinterModalProps {
  visible: boolean;
  initialValues?: Printer;
  onDismiss: () => void;
  onSaved: () => void;
}

export const AddPrinterModal: React.FC<AddPrinterModalProps> = ({ visible, initialValues, onDismiss, onSaved }) => {
  const printerId = useMemo(() => initialValues?.id ?? generateId(), [initialValues?.id]);
  const [connectionType, setConnectionType] = useState<ConnectionType>(initialValues?.connectionType ?? ConnectionType.usb);
  const [selectedDevice, setSelectedDevice] = useState<PrinterDevice | undefined>(initialValues?.device);
  const [autoReconnect, setAutoReconnect] = useState(initialValues?.autoReconnect ?? true);
  const [drivers, setDrivers] = useState<PrinterDriver[]>(initialValues?.drivers ?? []);
  const [testPrintReceiptPending, setTestPrintReceiptPending] = useState(false);
  const [testPrintLabelPending, setTestPrintLabelPending] = useState(false);
  const [testPrintErrorMessage, setTestPrintErrorMessage] = useState<string | null>(null);
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const [tsplFontPending, setTsplFontPending] = useState(false);
  const { captureNode, captureBillImage } = useBillImageCapture();
  const [liveStatus, setLiveStatus] = useState<PrinterStatus>(PrinterStatus.idle);
  const [connectionDirty, setConnectionDirty] = useState(!initialValues);

  const [connectionState, setConnectionState] = useState<ConnectionState>(initialValues ? 'connected' : 'idle');
  const [protocolState, setProtocolState] = useState<ProtocolState>(initialValues ? 'identified' : 'idle');
  const [lastProtocol, setLastProtocol] = useState<PrinterDriverType | undefined>(initialValues?.drivers[0]?.type);
  const [deviceInfo, setDeviceInfo] = useState<PrinterDeviceInfo | undefined>(undefined);
  const [connectionErrorMessage, setConnectionErrorMessage] = useState<string | undefined>(undefined);
  const [identityErrorMessage, setIdentityErrorMessage] = useState<string | undefined>(undefined);
  const [detectedLanIp, setDetectedLanIp] = useState<string | null>(null);
  const [lanIpFetchError, setLanIpFetchError] = useState<string | undefined>(undefined);

  const discoveryUnsubscribeRef = useRef<(() => void) | null>(null);
  const savedRef = useRef(false);
  const connectionRef = useRef<{ connectionState: ConnectionState; drivers: PrinterDriver[] }>({
    connectionState: initialValues ? 'connected' : 'idle',
    drivers: initialValues?.drivers ?? [],
  });

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
      name: initialValues?.name ?? '',
      paperSize: initialValues?.paperSize ?? 80,
    },
  });

  useEffect(() => {
    connectionRef.current = { connectionState, drivers };
  }, [connectionState, drivers]);

  useEffect(() => {
    const activeDriver = drivers[0];
    if (protocolState !== 'identified' || !activeDriver) {
      setLiveStatus(PrinterStatus.idle);
      return undefined;
    }
    setLiveStatus(PrinterService.getStatusForDriver(activeDriver.type, printerId));
    const unsubscribes = drivers.map((d) => PrinterService.onStatusChangeForDriver(d.type, printerId, setLiveStatus));
    return () => unsubscribes.forEach((unsub) => unsub());
  }, [protocolState, drivers, printerId]);

  useEffect(() => {
    if (!visible) {
      discoveryUnsubscribeRef.current?.();
      discoveryUnsubscribeRef.current = null;
      const current = connectionRef.current;
      if (current.connectionState === 'connected' && !savedRef.current) {
        current.drivers.forEach((d) => {
          PrinterService.disconnectForDriver(d.type, printerId).catch(() => undefined);
        });
      }
    }
    return () => {
      discoveryUnsubscribeRef.current?.();
    };
  }, [visible, printerId]);

  const buildLan = (values: LanConnectionValues) => ({ ip: values.lanIp, port: Number(values.lanPort) });

  /** Đủ thông tin để tính identityKey (không cần biết protocol) — xem `resolveIdentityKey`. */
  const currentIdentityKey = (): string | null => {
    try {
      if (connectionType === ConnectionType.lan) {
        const values = lanForm.getValues();
        if (!lanConnectionSchema.safeParse(values).success) return null;
        return resolveIdentityKey({ connectionType, lan: buildLan(values) });
      }
      if (!selectedDevice) return null;
      return resolveIdentityKey({ connectionType, device: selectedDevice });
    } catch {
      return null;
    }
  };

  useEffect(() => {
    const key = currentIdentityKey();
    if (!key) {
      setIdentityErrorMessage(undefined);
      return;
    }
    const collision = PrinterService.getPrinters().find((p) => p.id !== printerId && p.identityKey === key);
    setIdentityErrorMessage(
      collision ? `Máy in này đã được thêm với tên "${collision.name}" — dùng "+ Thêm driver" trên máy in đó thay vì thêm mới.` : undefined,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chạy lại khi connectionType/selectedDevice/lan form thay đổi, đọc qua currentIdentityKey() ở trên
  }, [connectionType, selectedDevice, lanForm.watch('lanIp'), lanForm.watch('lanPort')]);

  const resetDiscoveryFields = (nextConnectionState: ConnectionState): void => {
    setConnectionState(nextConnectionState);
    setProtocolState('idle');
    setDeviceInfo(undefined);
    setConnectionErrorMessage(undefined);
    // Chỉ khoá Save khi ĐÂY LÀ driver đầu tiên (chưa có driver nào saveable) —
    // 1 lượt dò driver thứ 2 thất bại không được lùi lại trạng thái saveable
    // đã có từ driver đầu tiên (spec §5.1, coordinator review round 1).
    if (drivers.length === 0) setConnectionDirty(true);
  };

  const resetConnectionResult = (): void => {
    discoveryUnsubscribeRef.current?.();
    discoveryUnsubscribeRef.current = null;
    resetDiscoveryFields('idle');
  };

  /** Thêm driver mới vào `drivers[]` với contentTypes mặc định = mọi type driver này hỗ trợ TRỪ type đã thuộc driver khác (invariant #3). */
  const addDriverToList = (type: PrinterDriverType, source: DriverSource): PrinterDriver => {
    const alreadyClaimed = new Set(drivers.flatMap((d) => d.contentTypes));
    const contentTypes = getDriverDefinition(type).contentTypes.filter((ct) => !alreadyClaimed.has(ct));
    const entry: PrinterDriver = { type, source, contentTypes, config: getDriverDefinition(type).defaultConfig };
    setDrivers((prev) => [...prev, entry]);
    return entry;
  };

  /**
   * `draftPrinter` truyền cho discovery phải ĐẦY ĐỦ (không chỉ id/connectionType/device/lan)
   * — driver.connect() lưu nó làm context sống của driver ngay cả khi discovery
   * thành công (context không bị clear ở nhánh 'identified'), nên thiếu field
   * (vd `paperSize`) sẽ làm 1 lần in thật xảy ra đồng thời dùng phải context cụt
   * (final-review finding #2). Dùng chung `buildDraftPrinter()` với đường
   * `onChooseProtocol` thay vì tự dựng 1 draft rời rạc ở đây.
   */
  const startDiscovery = (): void => {
    resetDiscoveryFields('connecting');
    discoveryUnsubscribeRef.current = PrinterService.discoverDriver(
      {
        draftPrinter: buildDraftPrinter(),
        excludedDrivers: drivers.map((d) => d.type),
      },
      (event: DiscoveryEvent) => {
        if (event.stage === 'identifying') {
          setProtocolState('detecting');
        } else if (event.stage === 'identified' && event.protocol) {
          setConnectionState('connected');
          setProtocolState('identified');
          setLastProtocol(event.protocol);
          setDeviceInfo(event.deviceInfo);
          setConnectionDirty(false);
          addDriverToList(event.protocol, DriverSource.auto);
          if (!displayForm.getValues('name')) {
            displayForm.setValue('name', event.deviceInfo?.deviceName ?? selectedDevice?.displayName ?? 'Máy in mới');
          }
        } else if (event.stage === 'unknown_protocol') {
          setConnectionState('idle');
          setProtocolState('unknown');
        } else if (event.stage === 'error') {
          setConnectionState('error');
          setProtocolState('idle');
          setConnectionErrorMessage(event.error?.message);
        }
      },
    );
  };

  const onConnectPress = (): void => {
    if (connectionType === ConnectionType.lan) {
      lanForm.handleSubmit(() => startDiscovery())();
    } else {
      startDiscovery();
    }
  };

  const buildDraftPrinter = (): Printer => ({
    id: printerId,
    name: displayForm.getValues('name') || 'Máy in mới',
    drivers,
    connectionType,
    device: connectionType === ConnectionType.lan ? undefined : selectedDevice,
    lan: connectionType === ConnectionType.lan ? buildLan(lanForm.getValues()) : undefined,
    identityKey: currentIdentityKey() ?? '',
    paperSize: displayForm.getValues('paperSize'),
    autoReconnect,
    enabled: initialValues?.enabled ?? true,
    createdAt: initialValues?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const onChooseProtocol = (chosenProtocol: PrinterDriverType): void => {
    setConnectionState('connecting');
    setProtocolState('detecting');
    const draftDriver: PrinterDriver = {
      type: chosenProtocol,
      source: DriverSource.manual,
      contentTypes: [],
      config: getDriverDefinition(chosenProtocol).defaultConfig,
    };
    const draftPrinter: Printer = { ...buildDraftPrinter(), drivers: [...drivers, draftDriver] };
    PrinterService.connectDraft(draftPrinter, draftDriver)
      .then(() => {
        setConnectionState('connected');
        setProtocolState('identified');
        setLastProtocol(chosenProtocol);
        setDeviceInfo(undefined);
        setConnectionDirty(false);
        addDriverToList(chosenProtocol, DriverSource.manual);
      })
      .catch((error: { message: string }) => {
        setConnectionState('error');
        setProtocolState('idle');
        setConnectionErrorMessage(error.message);
      });
  };

  const onConnectionTypeChange = (value: ConnectionType): void => {
    if (drivers.length > 0) return;
    setConnectionType(value);
    setSelectedDevice(undefined);
    if (connectionState !== 'idle' || protocolState !== 'idle') resetConnectionResult();
  };

  const onSelectDevice = (device: PrinterDevice): void => {
    if (drivers.length > 0) return;
    setSelectedDevice(device);
    if (connectionState !== 'idle' || protocolState !== 'idle') resetConnectionResult();
  };

  const onLanIpChange = (text: string): void => {
    if (drivers.length > 0) return;
    lanForm.setValue('lanIp', text);
    if (connectionState !== 'idle' || protocolState !== 'idle') resetConnectionResult();
  };

  const onLanPortChange = (text: string): void => {
    if (drivers.length > 0) return;
    lanForm.setValue('lanPort', text);
    if (connectionState !== 'idle' || protocolState !== 'idle') resetConnectionResult();
  };

  const onFetchLanIp = async (): Promise<void> => {
    setLanIpFetchError(undefined);
    const ip = await getCurrentWifiIp();
    if (!ip) {
      setDetectedLanIp(null);
      setLanIpFetchError('Không lấy được IP — kiểm tra đã kết nối WiFi chưa');
      return;
    }
    setDetectedLanIp(ip);
  };

  const onAutoFillLanIp = (): void => {
    if (!detectedLanIp) return;
    onLanIpChange(detectedLanIp);
  };

  const onUpdateDriverContentTypes = (type: PrinterDriverType, contentTypes: PrintType[]): void => {
    setDrivers((prev) => prev.map((d) => (d.type === type ? { ...d, contentTypes } : d)));
  };

  const onToggleTsplFont = async (enabled: boolean): Promise<void> => {
    const tsplDriverEntry = drivers.find((d) => d.type === PrinterDriverType.tspl);
    if (!tsplDriverEntry || tsplDriverEntry.config.type !== PrinterDriverType.tspl) return;

    if (!enabled) {
      setDrivers((prev) =>
        prev.map((d) => (d.type === PrinterDriverType.tspl && d.config.type === PrinterDriverType.tspl ? { ...d, config: { ...d.config, renderMode: TsplRenderMode.bitmap } } : d)),
      );
      return;
    }

    const font = tsplDriverEntry.config.font ?? DEFAULT_TSPL_FONT;
    setTsplFontPending(true);
    try {
      await PrinterService.installTsplFont(printerId, font);
      setDrivers((prev) =>
        prev.map((d) =>
          d.type === PrinterDriverType.tspl && d.config.type === PrinterDriverType.tspl
            ? { ...d, config: { ...d.config, renderMode: TsplRenderMode.truetype, font: { ...font, fontInstalled: true } } }
            : d,
        ),
      );
    } catch (error) {
      setTestPrintErrorMessage(error instanceof AppErrorException ? error.message : 'Cài font TrueType thất bại — vẫn dùng chế độ Bitmap');
      // renderMode stays 'bitmap' (default) — never set to 'truetype' on failure, per spec §6/§7.
    } finally {
      setTsplFontPending(false);
    }
  };

  const resolveTestPrintDocuments = async (driver: PrinterDriver, printer: Printer, document: import('../types/printDocument.types').PrintDocument): Promise<PrintDocumentVariants> => {
    if (driver.type !== PrinterDriverType.tspl || isTsplTrueTypeActive(driver)) return { text: document };
    const base64 = await captureBillImage(document, printer.paperSize);
    if (!base64) return { text: document };
    return { text: document, image: { elements: [{ type: 'image', data: base64, x: 0, y: 0 }] } };
  };

  const runTestPrint = async (
    setPending: (pending: boolean) => void,
    printType: PrintType,
    sampleDocument: import('../types/printDocument.types').PrintDocument,
  ): Promise<void> => {
    const driver = drivers.find((d) => d.contentTypes.includes(printType));
    if (!driver) return;
    const printer = buildDraftPrinter();
    const valid = await displayForm.trigger();
    if (!valid) return;
    setPending(true);
    setTestPrintErrorMessage(null);
    try {
      const documents = await resolveTestPrintDocuments(driver, printer, sampleDocument);
      await PrinterService.testPrint(printer, driver, documents, printType);
    } catch (error) {
      setTestPrintErrorMessage(error instanceof AppErrorException ? error.message : 'In thử thất bại');
    } finally {
      setPending(false);
    }
  };

  const onTestPrintReceipt = (): Promise<void> => runTestPrint(setTestPrintReceiptPending, PrintType.Receipt, buildSampleReceiptDocument());
  const onTestPrintLabel = (): Promise<void> => runTestPrint(setTestPrintLabelPending, PrintType.Label, buildSampleLabelDocument());

  const onSave = displayForm.handleSubmit(() => {
    if (drivers.length === 0) return;
    const printer = buildDraftPrinter();
    try {
      if (initialValues) PrinterService.updatePrinter(printer);
      else PrinterService.addPrinter(printer);
    } catch (error) {
      setSaveErrorMessage(error instanceof Error ? error.message : 'Lưu máy in thất bại');
      return;
    }
    savedRef.current = true;
    if (printer.autoReconnect && liveStatus !== PrinterStatus.connected) {
      PrinterService.connect(printer.id).catch(() => undefined);
    }
    onSaved();
  });

  const connectLabel = connectionState === 'connecting' ? 'Đang kết nối...' : connectionState === 'connected' ? 'Kết nối lại' : 'Kết nối';
  const connectDisabled =
    connectionState === 'connecting' ||
    (connectionType !== ConnectionType.lan && !selectedDevice) ||
    drivers.length >= 2 ||
    Boolean(identityErrorMessage);
  const hasEmptyContentTypeDriver = drivers.some((d) => d.contentTypes.length === 0);

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text variant="titleMedium">{initialValues ? 'Chỉnh sửa máy in' : 'Thêm máy in'}</Text>

          <ConnectionSection
            connectionType={connectionType}
            onConnectionTypeChange={onConnectionTypeChange}
            selectedDeviceId={selectedDevice?.deviceId}
            onSelectDevice={onSelectDevice}
            lanIp={lanForm.watch('lanIp')}
            lanPort={lanForm.watch('lanPort')}
            onLanIpChange={onLanIpChange}
            onLanPortChange={onLanPortChange}
            detectedLanIp={detectedLanIp}
            lanIpFetchError={lanIpFetchError}
            onFetchLanIp={onFetchLanIp}
            onAutoFillLanIp={onAutoFillLanIp}
            lanIpError={lanForm.formState.errors.lanIp?.message}
            lanPortError={lanForm.formState.errors.lanPort?.message}
            connectLabel={connectLabel}
            connectDisabled={connectDisabled}
            onConnectPress={onConnectPress}
            disabled={drivers.length > 0}
          />
          {identityErrorMessage ? <Text style={styles.identityError}>{identityErrorMessage}</Text> : null}

          <StatusPanel
            connectionState={connectionState}
            protocolState={protocolState}
            protocol={lastProtocol}
            deviceInfo={deviceInfo}
            errorMessage={connectionErrorMessage}
            excludedDrivers={drivers.map((d) => d.type)}
            onChooseProtocol={onChooseProtocol}
          />

          {drivers.length > 0 && drivers.length < 2 ? (
            <Text variant="bodySmall" style={styles.addDriverHint}>Máy in này còn hỗ trợ thêm driver khác — bấm "Kết nối" để dò tiếp.</Text>
          ) : null}

          {hasEmptyContentTypeDriver ? (
            <Text variant="bodySmall" style={styles.identityError}>
              Mỗi driver phải nhận in ít nhất 1 loại nội dung (Hoá đơn/Tem) — chọn ở phần bên dưới trước khi lưu.
            </Text>
          ) : null}

          <PrinterInfoCard
            control={displayForm.control}
            errors={displayForm.formState.errors}
            connectionType={connectionType}
            drivers={drivers}
            onUpdateDriverContentTypes={onUpdateDriverContentTypes}
            deviceInfo={deviceInfo}
            status={liveStatus}
            autoReconnect={autoReconnect}
            onAutoReconnectChange={setAutoReconnect}
            testPrintReceiptPending={testPrintReceiptPending}
            onTestPrintReceipt={onTestPrintReceipt}
            testPrintLabelPending={testPrintLabelPending}
            onTestPrintLabel={onTestPrintLabel}
            onToggleTsplFont={onToggleTsplFont}
            tsplFontPending={tsplFontPending}
            onSave={onSave}
            saveDisabled={drivers.length === 0 || connectionDirty || hasEmptyContentTypeDriver}
            locked={drivers.length === 0}
          />
          {captureNode}
        </ScrollView>
        <Snackbar visible={testPrintErrorMessage !== null} onDismiss={() => setTestPrintErrorMessage(null)} duration={5000}>
          {testPrintErrorMessage}
        </Snackbar>
        <Snackbar visible={saveErrorMessage !== null} onDismiss={() => setSaveErrorMessage(null)} duration={5000}>
          {saveErrorMessage}
        </Snackbar>
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  container: { backgroundColor: 'white', margin: 24, padding: 16, borderRadius: 16, maxHeight: '85%' },
  scrollContent: { gap: 12 },
  identityError: { color: '#B91C1C' },
  addDriverHint: { color: '#6B7280' },
});
