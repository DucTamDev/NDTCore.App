import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PrinterRepository } from '../services/PrinterRepository';
import { PrinterConnectionService } from '../services/PrinterConnectionService';
import { useBillImageCapture } from './useBillImageCapture';
import { generateId } from '../../../utils/id';
import { getDriverCapabilities } from '../drivers/DriverCapabilities';
import { printerDisplaySchema, type PrinterDisplayValues } from '../forms/addPrinter/PrinterDisplaySchema';
import type { ConnectionSectionProps } from '../components/ConnectionSection';
import type { StatusPanelProps, ConnectionState, ProtocolState } from '../components/StatusPanel';
import type { PrinterInfoCardProps } from '../components/PrinterInfoCard';
import { ConnectionType } from '../models/printer/PrinterDevice';
import { DriverSource, PrinterDriverType } from '../models/printer/PrinterDriver';
import { PrinterStatus } from '../models/printer/PrinterStatus';
import { mediaOf } from '../drivers/driverConfig';
import type { Printer } from '../models/printer/Printer';
import type { PrinterDriver } from '../models/printer/PrinterDriver';
import type { UsbRawDevice } from '../models/printer/PrinterDevice';
import { dieCutMediaError } from '../media/validation';
import { useConnectionSetup } from './addPrinter/useConnectionSetup';
import { useProtocolDiscovery } from './addPrinter/useProtocolDiscovery';
import { useTestPrint } from './addPrinter/useTestPrint';
import { useDriverConfig } from './addPrinter/useDriverConfig';

export interface UseAddPrinterFlowInput {
  visible: boolean;
  initialValues?: Printer;
  onSaved: () => void;
}

export interface UseAddPrinterFlow {
  title: string;
  connectionSection: ConnectionSectionProps;
  identityErrorMessage?: string;
  statusPanel: StatusPanelProps;
  showAddDriverHint: boolean;
  hasEmptyContentTypeDriver: boolean;
  infoCard: PrinterInfoCardProps;
  captureNode: ReactNode;
  testPrintErrorMessage: string | null;
  saveErrorMessage: string | null;
  clearTestPrintError: () => void;
  clearSaveError: () => void;
}

/**
 * Toàn bộ orchestration của luồng Thêm/Sửa máy in — scan, discovery, dựng draft,
 * cài font TrueType, in thử, lưu. Tách khỏi `AddPrinterModal` để component chỉ
 * còn render + wiring: mọi state machine (connection/protocol), side-effect vòng
 * đời kết nối và gọi các service máy in nằm ở đây.
 *
 * Coordinator sở hữu state chồng lấn (`drivers`, `displayForm`, `autoReconnect`,
 * `buildDraftPrinter`, vòng đời kết nối) và ghép 4 hook con dưới `addPrinter/`:
 * `useConnectionSetup`, `useProtocolDiscovery`, `useTestPrint`, `useDriverConfig`.
 */
export const useAddPrinterFlow = ({ visible, initialValues, onSaved }: UseAddPrinterFlowInput): UseAddPrinterFlow => {
  const printerId = useMemo(() => initialValues?.id ?? generateId(), [initialValues?.id]);
  const [autoReconnect, setAutoReconnect] = useState(initialValues?.autoReconnect ?? true);
  const [drivers, setDrivers] = useState<PrinterDriver[]>(initialValues?.drivers ?? []);
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const { captureNode, captureBillImage } = useBillImageCapture();
  const [liveStatus, setLiveStatus] = useState<PrinterStatus>(PrinterStatus.idle);

  const displayForm = useForm<PrinterDisplayValues>({
    resolver: zodResolver(printerDisplaySchema),
    defaultValues: {
      name: initialValues?.name ?? '',
    },
  });

  const discoveryUnsubscribeRef = useRef<(() => void) | null>(null);
  const savedRef = useRef(false);
  const connectionRef = useRef<{ connectionState: ConnectionState; drivers: PrinterDriver[] }>({
    connectionState: initialValues ? 'connected' : 'idle',
    drivers: initialValues?.drivers ?? [],
  });
  // Bridge để `useConnectionSetup` đọc state của `useProtocolDiscovery` tại thời
  // điểm handler chạy — phá vòng phụ thuộc giữa 2 hook con (guard reset-on-change
  // trong onConnectionTypeChange/onSelectDevice/onLanIp*Change vẫn nguyên văn).
  const discoveryRef = useRef<{
    connectionState: ConnectionState;
    protocolState: ProtocolState;
    resetConnectionResult: () => void;
  }>({
    connectionState: initialValues ? 'connected' : 'idle',
    protocolState: initialValues ? 'identified' : 'idle',
    resetConnectionResult: () => undefined,
  });

  const connectionSetup = useConnectionSetup({
    initialValues,
    printerId,
    drivers,
    getConnectionState: () => discoveryRef.current.connectionState,
    getProtocolState: () => discoveryRef.current.protocolState,
    resetConnectionResult: () => discoveryRef.current.resetConnectionResult(),
  });
  const { connectionType, selectedDevice, lanForm, buildLan, currentIdentityKey, identityErrorMessage } = connectionSetup;

  /**
   * `draftPrinter` truyền cho discovery phải ĐẦY ĐỦ (không chỉ id/connectionType/device/lan)
   * — driver.connect() lưu nó làm context sống của driver ngay cả khi discovery
   * thành công (context không bị clear ở nhánh 'identified'), nên thiếu field
   * (vd `media`) sẽ làm 1 lần in thật xảy ra đồng thời dùng phải context cụt
   * (final-review finding #2).
   */
  const buildDraftPrinter = (): Printer => {
    const usbRaw = connectionType === ConnectionType.usb ? (selectedDevice?.rawDevice as unknown as UsbRawDevice | undefined) : undefined;
    return {
    id: printerId,
    name: displayForm.getValues('name') || 'Máy in mới',
    vendor: initialValues?.vendor ?? usbRaw?.manufacturerName ?? undefined,
    model: initialValues?.model ?? usbRaw?.productName ?? undefined,
    connection: {
      type: connectionType,
      device: connectionType === ConnectionType.lan ? undefined : selectedDevice,
      lan: connectionType === ConnectionType.lan ? buildLan(lanForm.getValues()) : undefined,
    },
    identityKey: currentIdentityKey() ?? '',
    capabilities: initialValues?.capabilities ?? { cutter: false },
    drivers,
    autoReconnect,
    enabled: initialValues?.enabled ?? true,
    createdAt: initialValues?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    };
  };

  /** TRỪ content type đã thuộc driver khác (invariant #3). */
  const addDriverToList = (type: PrinterDriverType, source: DriverSource): void => {
    const alreadyClaimed = new Set(drivers.flatMap((d) => d.contentTypes));
    const contentTypes = getDriverCapabilities(type).contentTypes.filter((ct) => !alreadyClaimed.has(ct));
    const def = getDriverCapabilities(type).defaultConfig;
    const entry: PrinterDriver = {
      type,
      source,
      contentTypes,
      config: { ...def, media: { ...def.media } },
    };
    setDrivers((prev) => [...prev, entry]);
  };

  /**
   * Điền sẵn "Tên hiển thị" bằng tên thiết bị khi kết nối — chỉ khi ô còn
   * TRỐNG (user đã gõ thì giữ nguyên). Sau đó ô vẫn sửa được bình thường.
   */
  const prefillDisplayName = (deviceName?: string): void => {
    if (displayForm.getValues('name')) return;
    const lanIp = connectionType === ConnectionType.lan ? lanForm.getValues('lanIp') : undefined;
    displayForm.setValue(
      'name',
      deviceName ?? selectedDevice?.displayName ?? (lanIp ? `Máy in ${lanIp}` : 'Máy in mới'),
    );
  };

  const testPrint = useTestPrint({ drivers, displayForm, buildDraftPrinter, captureBillImage });
  const driverConfig = useDriverConfig({
    printerId,
    drivers,
    setDrivers,
    setTestPrintErrorMessage: testPrint.setTestPrintErrorMessage,
  });

  const protocolDiscovery = useProtocolDiscovery({
    initialValues,
    drivers,
    connectionType,
    lanForm,
    discoveryUnsubscribeRef,
    buildDraftPrinter,
    addDriverToList,
    refreshUsbSerial: connectionSetup.refreshUsbSerial,
    prefillDisplayName,
  });
  /**
   * `useConnectionSetup` và `useProtocolDiscovery` phụ thuộc 2 chiều (connection
   * cần connectionState/reset từ discovery; discovery cần connectionType/lanForm
   * từ connection). Coordinator giữ `discoveryRef` làm cầu: gán trong render,
   * `useConnectionSetup` đọc qua getter tại thời điểm event → luôn là giá trị
   * render đã commit, tương đương closure gốc. Không tách được cycle mà không
   * gộp 2 hook — chấp nhận cầu này.
   */
  discoveryRef.current = {
    connectionState: protocolDiscovery.connectionState,
    protocolState: protocolDiscovery.protocolState,
    resetConnectionResult: protocolDiscovery.resetConnectionResult,
  };
  const { connectionState, protocolState, deviceInfo, connectionDirty } = protocolDiscovery;

  useEffect(() => {
    connectionRef.current = { connectionState, drivers };
  }, [connectionState, drivers]);

  useEffect(() => {
    const activeDriver = drivers[0];
    if (protocolState !== 'identified' || !activeDriver) {
      setLiveStatus(PrinterStatus.idle);
      return undefined;
    }
    setLiveStatus(PrinterConnectionService.getStatusForDriver(activeDriver.type, printerId));
    const unsubscribes = drivers.map((d) => PrinterConnectionService.onStatusChangeForDriver(d.type, printerId, setLiveStatus));
    return () => unsubscribes.forEach((unsub) => unsub());
  }, [protocolState, drivers, printerId]);

  useEffect(() => {
    if (!visible) {
      discoveryUnsubscribeRef.current?.();
      discoveryUnsubscribeRef.current = null;
      const current = connectionRef.current;
      if (current.connectionState === 'connected' && !savedRef.current) {
        current.drivers.forEach((d) => {
          PrinterConnectionService.disconnectForDriver(d.type, printerId).catch(() => undefined);
        });
      }
    }
    return () => {
      discoveryUnsubscribeRef.current?.();
    };
  }, [visible, printerId]);

  // Trên phone, `PrinterManagementPanel` unmount `AddPrinterForm` khi backToList
  // với `visible` vẫn `true` → nhánh `!visible` ở trên không chạy. Cleanup theo
  // vòng đời mount đảm bảo draft đang connected (chưa Save) được ngắt kết nối.
  useEffect(
    () => () => {
      const current = connectionRef.current;
      if (current.connectionState === 'connected' && !savedRef.current) {
        current.drivers.forEach((d) => PrinterConnectionService.disconnectForDriver(d.type, printerId).catch(() => undefined));
      }
    },
    [printerId],
  );

  const onSave = displayForm.handleSubmit(() => {
    if (drivers.length === 0) return;
    const printer = buildDraftPrinter();
    try {
      if (initialValues) PrinterRepository.updatePrinter(printer);
      else PrinterRepository.addPrinter(printer);
    } catch (error) {
      setSaveErrorMessage(error instanceof Error ? error.message : 'Lưu máy in thất bại');
      return;
    }
    savedRef.current = true;
    if (liveStatus === PrinterStatus.connected) {
      PrinterConnectionService.reconnect(printer.id).catch(() => undefined);
    } else if (printer.autoReconnect) {
      PrinterConnectionService.connect(printer.id).catch(() => undefined);
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

  return {
    title: initialValues ? 'Chỉnh sửa máy in' : 'Thêm máy in',
    identityErrorMessage,
    showAddDriverHint: drivers.length > 0 && drivers.length < 2,
    hasEmptyContentTypeDriver,
    captureNode,
    testPrintErrorMessage: testPrint.testPrintErrorMessage,
    saveErrorMessage,
    clearTestPrintError: testPrint.clearTestPrintError,
    clearSaveError: () => setSaveErrorMessage(null),
    connectionSection: {
      connectionType,
      onConnectionTypeChange: connectionSetup.onConnectionTypeChange,
      selectedDeviceId: selectedDevice?.deviceId,
      onSelectDevice: connectionSetup.onSelectDevice,
      lanIp: lanForm.watch('lanIp'),
      lanPort: lanForm.watch('lanPort'),
      onLanIpChange: connectionSetup.onLanIpChange,
      onLanPortChange: connectionSetup.onLanPortChange,
      detectedLanIp: connectionSetup.detectedLanIp,
      lanIpFetchError: connectionSetup.lanIpFetchError,
      onFetchLanIp: connectionSetup.onFetchLanIp,
      onAutoFillLanIp: connectionSetup.onAutoFillLanIp,
      lanIpError: lanForm.formState.errors.lanIp?.message,
      lanPortError: lanForm.formState.errors.lanPort?.message,
      connectLabel,
      connectDisabled,
      onConnectPress: protocolDiscovery.onConnectPress,
      disabled: drivers.length > 0,
    },
    statusPanel: {
      connectionState,
      protocolState,
      protocol: protocolDiscovery.lastProtocol,
      deviceInfo,
      errorMessage: protocolDiscovery.connectionErrorMessage,
      excludedDrivers: drivers.map((d) => d.type),
      onChooseProtocol: protocolDiscovery.onChooseProtocol,
    },
    infoCard: {
      control: displayForm.control,
      errors: displayForm.formState.errors,
      connectionType,
      drivers,
      onToggleContentType: driverConfig.onToggleContentType,
      deviceInfo,
      status: liveStatus,
      autoReconnect,
      onAutoReconnectChange: setAutoReconnect,
      testPrintReceiptPending: testPrint.testPrintReceiptPending,
      onTestPrintReceipt: testPrint.onTestPrintReceipt,
      testPrintLabelPending: testPrint.testPrintLabelPending,
      onTestPrintLabel: testPrint.onTestPrintLabel,
      onSelectTsplRenderMode: driverConfig.onSelectTsplRenderMode,
      onChangeTsplInternalFont: driverConfig.onChangeTsplInternalFont,
      onChangeDriverMedia: driverConfig.onChangeDriverMedia,
      testPrintRowsText: testPrint.testPrintRowsText,
      onTestPrintRowsChange: testPrint.setTestPrintRowsText,
      hasTsplDriver: drivers.some((d) => d.type === PrinterDriverType.tspl),
      tsplFontPending: driverConfig.tsplFontPending,
      onSave,
      saveDisabled:
        drivers.length === 0 ||
        connectionDirty ||
        hasEmptyContentTypeDriver ||
        drivers.some((d) => dieCutMediaError(mediaOf(d)) != null),
      locked: drivers.length === 0,
    },
  };
};
