import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PrinterRepository } from '../storage/PrinterRepository';
import type { PrinterWriteInput } from '../storage/PrinterWriteInput';
import { PrinterConnectionService } from '../connection/PrinterConnectionService';
import { useBillImageCapture } from './useBillImageCapture';
import { generateId } from '../../../utils/id';
import { printerDisplaySchema, type PrinterDisplayValues } from '../forms/addPrinter/PrinterDisplaySchema';
import type { ConnectionSectionProps } from '../components/ConnectionSection';
import type { StatusPanelProps, ConnectionState, ProtocolState } from '../components/StatusPanel';
import type { PrinterInfoCardProps } from '../components/PrinterInfoCard';
import { PrinterConnectionType } from '../models/printer/PrinterConnection';
import { DriverSource, PrinterDriverType, RenderMode } from '../models/printer/PrinterDriver';
import type { PrinterDriver } from '../models/printer/PrinterDriver';
import { PrinterStatus } from '../models/printer/PrinterStatus';
import type { PrintType } from '../models/printing/PrintType';
import { DEFAULT_PAPER } from '../drivers/driverConfig';
import type { PrintPaperConfig } from '../models/paper/PrintPaperConfig';
import type { Printer } from '../models/printer/Printer';
import type { UsbRawDevice } from '../models/printer/PrinterDevice';
import { dieCutMediaError } from '../paper/validation';
import { buildBluetoothConnection, buildLanConnection, buildUsbConnection } from '../discovery/PrinterResolver';
import type { PrinterConnection } from '../models/printer/PrinterConnection';
import { useConnectionSetup } from './addPrinter/useConnectionSetup';
import { useProtocolDiscovery } from './addPrinter/useProtocolDiscovery';
import { useTestPrint } from './addPrinter/useTestPrint';
import { useDriverConfig } from './addPrinter/useDriverConfig';

export interface UseAddPrinterFlowInput {
  visible: boolean;
  initialValues?: Printer;
  onSaved: () => void;
  /** Loại nội dung CỐ ĐỊNH của printer này — tab đang mở lúc Thêm mới, hoặc `initialValues.type` lúc Sửa. */
  printType: PrintType;
}

export interface UseAddPrinterFlow {
  title: string;
  connectionSection: ConnectionSectionProps;
  identityErrorMessage?: string;
  statusPanel: StatusPanelProps;
  hasDieCutMediaError: boolean;
  infoCard: PrinterInfoCardProps;
  captureNode: ReactNode;
  testPrintErrorMessage: string | null;
  saveErrorMessage: string | null;
  clearTestPrintError: () => void;
  clearSaveError: () => void;
}

/** Nhãn nút "Kết nối" theo `connectionState` hiện tại. */
const resolveConnectLabel = (connectionState: ConnectionState): string => {
  if (connectionState === 'connecting') {
    return 'Đang kết nối...';
  }

  if (connectionState === 'connected') {
    return 'Kết nối lại';
  }

  return 'Kết nối';
};

/** Placeholder — GHI ĐÈ ngay bởi `PrinterDiscoveryService` cho từng candidate lúc dò; chỉ để thoả kiểu `Printer.driver` (không optional) trước khi có driver thật. */
const PLACEHOLDER_DRIVER: PrinterDriver = { type: PrinterDriverType.EscPos, source: DriverSource.Auto, config: { renderMode: RenderMode.Encoder } };

/**
 * Toàn bộ orchestration của luồng Thêm/Sửa máy in — scan, discovery, dựng draft,
 * in thử, lưu. Tách khỏi `AddPrinterModal` để component chỉ còn render + wiring.
 *
 * Coordinator sở hữu state chồng lấn (`driver`, `paper`, `displayForm`, `autoReconnect`,
 * `buildDraftPrinter`, vòng đời kết nối) và ghép 4 hook con dưới `addPrinter/`:
 * `useConnectionSetup`, `useProtocolDiscovery`, `useTestPrint`, `useDriverConfig`.
 * Mỗi `Printer` giờ ĐÚNG 1 driver — không còn "dò thêm driver thứ 2 trong 1 lần mở".
 */
export const useAddPrinterFlow = ({ visible, initialValues, onSaved, printType }: UseAddPrinterFlowInput): UseAddPrinterFlow => {
  const printerId = useMemo(() => initialValues?.id ?? generateId(), [initialValues?.id]);
  const [autoReconnect, setAutoReconnect] = useState(initialValues?.autoReconnect ?? true);
  const [driver, setDriver] = useState<PrinterDriver | undefined>(initialValues?.driver);
  const [paper, setPaper] = useState<PrintPaperConfig>(initialValues?.paper ?? { ...DEFAULT_PAPER });
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const { captureNode, captureBillImage } = useBillImageCapture();
  const [liveStatus, setLiveStatus] = useState<PrinterStatus>(PrinterStatus.Idle);

  const displayForm = useForm<PrinterDisplayValues>({
    resolver: zodResolver(printerDisplaySchema),
    defaultValues: {
      name: initialValues?.name ?? '',
    },
  });

  const discoveryUnsubscribeRef = useRef<(() => void) | null>(null);
  const savedRef = useRef(false);
  const connectionRef = useRef<{ connectionState: ConnectionState; driver?: PrinterDriver }>({
    connectionState: initialValues ? 'connected' : 'idle',
    driver: initialValues?.driver,
  });
  // Bridge để `useConnectionSetup` đọc state của `useProtocolDiscovery` tại thời
  // điểm handler chạy — phá vòng phụ thuộc giữa 2 hook con.
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
    printType,
    hasDriver: Boolean(driver),
    getConnectionState: () => discoveryRef.current.connectionState,
    getProtocolState: () => discoveryRef.current.protocolState,
    resetConnectionResult: () => discoveryRef.current.resetConnectionResult(),
  });
  const { connectionType, selectedDevice, lanForm, buildLan, currentIdentityKey, identityErrorMessage } = connectionSetup;

  const buildConnection = (): PrinterConnection => {
    if (connectionType === PrinterConnectionType.Lan) {
      const { ip, port } = buildLan(lanForm.getValues());
      return buildLanConnection(ip, port);
    }

    if (selectedDevice) {
      return connectionType === PrinterConnectionType.Usb ? buildUsbConnection(selectedDevice) : buildBluetoothConnection(selectedDevice);
    }

    return connectionType === PrinterConnectionType.Usb
      ? { type: PrinterConnectionType.Usb, vendorId: 0, productId: 0 }
      : { type: PrinterConnectionType.Bluetooth, deviceId: '' };
  };

  /**
   * `draftPrinter` truyền cho discovery phải ĐẦY ĐỦ — `driver.connect()` lưu
   * nó làm context sống ngay cả khi discovery thành công. `driver: driver ??
   * PLACEHOLDER_DRIVER` KHÔNG được dùng thật lúc dò (mỗi candidate tự gắn
   * driver riêng, xem `PrinterDiscoveryService`) — chỉ có ý nghĩa thật khi
   * `driver` đã có giá trị (đã identify xong, dùng cho `testPrint`/Save).
   */
  const buildDraftPrinter = (): PrinterWriteInput => {
    const usbRaw = connectionType === PrinterConnectionType.Usb ? (selectedDevice?.rawDevice as unknown as UsbRawDevice | undefined) : undefined;
    return {
      id: printerId,
      type: printType,
      name: displayForm.getValues('name') || 'Máy in mới',
      vendor: initialValues?.vendor ?? usbRaw?.manufacturerName ?? undefined,
      model: initialValues?.model ?? usbRaw?.productName ?? undefined,
      connection: buildConnection(),
      identityKey: currentIdentityKey() ?? undefined,
      capabilities: initialValues?.capabilities ?? { cutter: false },
      driver: driver ?? PLACEHOLDER_DRIVER,
      paper,
      autoReconnect,
      enabled: initialValues?.enabled ?? true,
      createdAt: initialValues?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  };

  /** `useTestPrint`/`useProtocolDiscovery` cần `Printer` đủ — `?? ''` chỉ là fallback kiểu, không chạm tới trên thực tế khi đã có device/LAN hợp lệ. */
  const buildFullDraftPrinter = (): Printer => {
    const draft = buildDraftPrinter();
    return { ...draft, identityKey: draft.identityKey ?? '' };
  };

  /**
   * Điền sẵn "Tên hiển thị" bằng tên thiết bị khi kết nối — chỉ khi ô còn TRỐNG.
   */
  const prefillDisplayName = (deviceName?: string): void => {
    if (displayForm.getValues('name')) {
      return;
    }

    const lanIp = connectionType === PrinterConnectionType.Lan ? lanForm.getValues('lanIp') : undefined;
    displayForm.setValue(
      'name',
      deviceName ?? selectedDevice?.displayName ?? (lanIp ? `Máy in ${lanIp}` : 'Máy in mới'),
    );
  };

  const testPrint = useTestPrint({ driver, displayForm, buildDraftPrinter: buildFullDraftPrinter, captureBillImage });
  const driverConfig = useDriverConfig({ printerId, driver, setDriver, paper, setPaper });

  const protocolDiscovery = useProtocolDiscovery({
    initialValues,
    connectionType,
    lanForm,
    discoveryUnsubscribeRef,
    buildDraftPrinter: buildFullDraftPrinter,
    setDriver,
    refreshUsbSerial: connectionSetup.refreshUsbSerial,
    prefillDisplayName,
  });
  discoveryRef.current = {
    connectionState: protocolDiscovery.connectionState,
    protocolState: protocolDiscovery.protocolState,
    resetConnectionResult: protocolDiscovery.resetConnectionResult,
  };
  const { connectionState, protocolState, deviceInfo, connectionDirty } = protocolDiscovery;

  useEffect(() => {
    connectionRef.current = { connectionState, driver };
  }, [connectionState, driver]);

  useEffect(() => {
    if (!driver) {
      setLiveStatus(PrinterStatus.Idle);
      return undefined;
    }

    setLiveStatus(PrinterConnectionService.getStatusForDriver(driver.type, printerId));
    return PrinterConnectionService.onStatusChangeForDriver(driver.type, printerId, setLiveStatus);
  }, [driver, printerId]);

  useEffect(() => {
    if (!visible) {
      discoveryUnsubscribeRef.current?.();
      discoveryUnsubscribeRef.current = null;
      const current = connectionRef.current;
      if (current.connectionState === 'connected' && current.driver && !savedRef.current) {
        PrinterConnectionService.disconnectForDriver(current.driver.type, printerId).catch(() => undefined);
      }
    }
    return () => {
      discoveryUnsubscribeRef.current?.();
    };
  }, [visible, printerId]);

  // Trên phone, `PrinterManagementPanel` unmount `AddPrinterForm` khi backToList
  // với `visible` vẫn `true` → nhánh `!visible` ở trên không chạy.
  useEffect(
    () => () => {
      const current = connectionRef.current;
      if (current.connectionState === 'connected' && current.driver && !savedRef.current) {
        PrinterConnectionService.disconnectForDriver(current.driver.type, printerId).catch(() => undefined);
      }
    },
    [printerId],
  );

  const onSave = displayForm.handleSubmit(() => {
    if (!driver) {
      return;
    }

    const printer = buildDraftPrinter();

    try {
      if (initialValues) {
        PrinterRepository.updatePrinter(printer);
      } else {
        PrinterRepository.addPrinter(printer);
      }
    } catch (error) {
      setSaveErrorMessage(error instanceof Error ? error.message : 'Lưu máy in thất bại');
      return;
    }
    savedRef.current = true;
    if (liveStatus === PrinterStatus.Connected) {
      PrinterConnectionService.reconnect(printer.id).catch(() => undefined);
    } else if (printer.autoReconnect) {
      PrinterConnectionService.connect(printer.id).catch(() => undefined);
    }
    onSaved();
  });

  const connectLabel = resolveConnectLabel(connectionState);
  const connectDisabled =
    connectionState === 'connecting' ||
    (connectionType !== PrinterConnectionType.Lan && !selectedDevice) ||
    Boolean(identityErrorMessage);
  const hasDieCutMediaError = dieCutMediaError(paper) != null;

  return {
    title: initialValues ? 'Chỉnh sửa máy in' : 'Thêm máy in',
    identityErrorMessage,
    hasDieCutMediaError,
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
      disabled: Boolean(driver),
    },
    statusPanel: {
      connectionState,
      protocolState,
      protocol: protocolDiscovery.lastProtocol,
      deviceInfo,
      errorMessage: protocolDiscovery.connectionErrorMessage,
      printType,
      onChooseProtocol: protocolDiscovery.onChooseProtocol,
    },
    infoCard: {
      control: displayForm.control,
      errors: displayForm.formState.errors,
      connectionType,
      driver,
      paper,
      onChangePaper: driverConfig.onChangePaper,
      deviceInfo,
      status: liveStatus,
      autoReconnect,
      onAutoReconnectChange: setAutoReconnect,
      testPrintPending: testPrint.testPrintPending,
      onTestPrint: testPrint.onTestPrint,
      onSelectRenderMode: driverConfig.onSelectRenderMode,
      testPrintRowsText: testPrint.testPrintRowsText,
      onTestPrintRowsChange: testPrint.setTestPrintRowsText,
      printType,
      onSave,
      saveDisabled: !driver || connectionDirty || hasDieCutMediaError,
      locked: !driver,
    },
  };
};
