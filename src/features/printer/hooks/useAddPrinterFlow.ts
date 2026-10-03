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
import { ConnectionType } from '../models/printer/ConnectionType';
import { LanguageSelection, PrintLanguage } from '../models/printer/PrinterLanguage';
import type { PrinterLanguage } from '../models/printer/PrinterLanguage';
import { PrinterStatus } from '../models/printer/PrinterStatus';
import type { PrintKind } from '../models/printer/PrintKind';
import { createPrinterDraft, createPrinterLanguage, DEFAULT_PAPER } from '../management/createPrinterDraft';
import { toPaperOptions, type PaperDraft } from '../forms/addPrinter/PaperDraft';
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
  kind: PrintKind;
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

/** Giá trị tạm để bản nháp đủ kiểu `Printer` trước khi dò xong ngôn ngữ; lúc dò mỗi ngôn ngữ thử tự ghi đè. */
const PLACEHOLDER_LANGUAGE: PrinterLanguage = createPrinterLanguage(PrintLanguage.EscPos, LanguageSelection.Auto);

/**
 * Toàn bộ orchestration của luồng Thêm/Sửa máy in — scan, discovery, dựng draft,
 * in thử, lưu. Tách khỏi `AddPrinterModal` để component chỉ còn render + wiring.
 *
 * Coordinator sở hữu state chồng lấn (`language`, `paper`, `displayForm`, `autoReconnect`,
 * `buildDraftPrinter`, vòng đời kết nối) và ghép 4 hook con dưới `addPrinter/`:
 * `useConnectionSetup`, `useProtocolDiscovery`, `useTestPrint`, `useDriverConfig`.
 */
export const useAddPrinterFlow = ({ visible, initialValues, onSaved, kind }: UseAddPrinterFlowInput): UseAddPrinterFlow => {
  const printerId = useMemo(() => initialValues?.id ?? generateId(), [initialValues?.id]);
  const [autoReconnect, setAutoReconnect] = useState(initialValues?.autoReconnect ?? true);
  const [language, setLanguage] = useState<PrinterLanguage | undefined>(initialValues?.language);
  const [paper, setPaper] = useState<PaperDraft>(initialValues?.paper ?? { ...DEFAULT_PAPER });
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
  const connectionRef = useRef<{ connectionState: ConnectionState; language?: PrinterLanguage }>({
    connectionState: initialValues ? 'connected' : 'idle',
    language: initialValues?.language,
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
    kind,
    hasDriver: Boolean(language),
    getConnectionState: () => discoveryRef.current.connectionState,
    getProtocolState: () => discoveryRef.current.protocolState,
    resetConnectionResult: () => discoveryRef.current.resetConnectionResult(),
  });
  const { connectionType, selectedDevice, lanForm, buildLan, currentIdentityKey, identityErrorMessage } = connectionSetup;

  const buildConnection = (): PrinterConnection => {
    if (connectionType === ConnectionType.Lan) {
      const { ip, port } = buildLan(lanForm.getValues());
      return buildLanConnection(ip, port);
    }

    if (selectedDevice) {
      return connectionType === ConnectionType.Usb ? buildUsbConnection(selectedDevice) : buildBluetoothConnection(selectedDevice);
    }

    return connectionType === ConnectionType.Usb
      ? { type: ConnectionType.Usb, vendorId: 0, productId: 0 }
      : { type: ConnectionType.Bluetooth, mac: '' };
  };

  /**
   * Bản nháp phải đủ field vì driver giữ nó làm ngữ cảnh kết nối. `PLACEHOLDER_LANGUAGE` không được dùng khi dò
   * (mỗi ngôn ngữ thử tự gắn cấu hình riêng); chỉ có nghĩa khi đã xác định ngôn ngữ, lúc in thử hoặc lưu.
   */
  const buildDraftPrinter = (): PrinterWriteInput => {
    const usbRaw = connectionType === ConnectionType.Usb ? (selectedDevice?.rawDevice as unknown as UsbRawDevice | undefined) : undefined;
    const draft = createPrinterDraft({
      id: printerId,
      kind,
      connection: buildConnection(),
      language: language ?? PLACEHOLDER_LANGUAGE,
    });

    return {
      ...draft,
      name: displayForm.getValues('name') || draft.name,
      vendor: initialValues?.vendor ?? usbRaw?.manufacturerName ?? undefined,
      model: initialValues?.model ?? usbRaw?.productName ?? undefined,
      deviceId: currentIdentityKey() ?? undefined,
      capabilities: initialValues?.capabilities ?? draft.capabilities,
      // Kết nối và dò ngôn ngữ không phụ thuộc giấy; Lưu và In thử bị chặn khi giấy tem còn thiếu kích thước.
      paper: toPaperOptions(paper) ?? DEFAULT_PAPER,
      autoReconnect,
      enabled: initialValues?.enabled ?? true,
      createdAt: initialValues?.createdAt ?? draft.createdAt,
    };
  };

  /** `useTestPrint`/`useProtocolDiscovery` cần `Printer` đủ — `?? ''` chỉ là fallback kiểu, không chạm tới trên thực tế khi đã có device/LAN hợp lệ. */
  const buildFullDraftPrinter = (): Printer => {
    const draft = buildDraftPrinter();
    return { ...draft, deviceId: draft.deviceId ?? '' };
  };

  /**
   * Điền sẵn "Tên hiển thị" bằng tên thiết bị khi kết nối — chỉ khi ô còn TRỐNG.
   */
  const prefillDisplayName = (deviceName?: string): void => {
    if (displayForm.getValues('name')) {
      return;
    }

    const lanIp = connectionType === ConnectionType.Lan ? lanForm.getValues('lanIp') : undefined;
    displayForm.setValue(
      'name',
      deviceName ?? selectedDevice?.displayName ?? (lanIp ? `Máy in ${lanIp}` : 'Máy in mới'),
    );
  };

  const paperError = dieCutMediaError(paper);
  const testPrint = useTestPrint({ language, paperError, displayForm, buildDraftPrinter: buildFullDraftPrinter, captureBillImage });
  const driverConfig = useDriverConfig({ printerId, language, setLanguage, paper, setPaper });

  const protocolDiscovery = useProtocolDiscovery({
    initialValues,
    connectionType,
    lanForm,
    discoveryUnsubscribeRef,
    buildDraftPrinter: buildFullDraftPrinter,
    setLanguage,
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
    connectionRef.current = { connectionState, language };
  }, [connectionState, language]);

  useEffect(() => {
    if (!language) {
      setLiveStatus(PrinterStatus.Idle);
      return undefined;
    }

    setLiveStatus(PrinterConnectionService.getStatusForDriver(language.type, printerId));
    return PrinterConnectionService.onStatusChangeForDriver(language.type, printerId, setLiveStatus);
  }, [language, printerId]);

  useEffect(() => {
    if (!visible) {
      discoveryUnsubscribeRef.current?.();
      discoveryUnsubscribeRef.current = null;
      const current = connectionRef.current;
      if (current.connectionState === 'connected' && current.language && !savedRef.current) {
        PrinterConnectionService.disconnectForDriver(current.language.type, printerId).catch(() => undefined);
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
      if (current.connectionState === 'connected' && current.language && !savedRef.current) {
        PrinterConnectionService.disconnectForDriver(current.language.type, printerId).catch(() => undefined);
      }
    },
    [printerId],
  );

  const onSave = displayForm.handleSubmit(() => {
    if (!language) {
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
    (connectionType !== ConnectionType.Lan && !selectedDevice) ||
    Boolean(identityErrorMessage);
  const hasDieCutMediaError = paperError != null;

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
      disabled: Boolean(language),
    },
    statusPanel: {
      connectionState,
      protocolState,
      protocol: protocolDiscovery.lastProtocol,
      deviceInfo,
      errorMessage: protocolDiscovery.connectionErrorMessage,
      kind,
      onChooseProtocol: protocolDiscovery.onChooseProtocol,
    },
    infoCard: {
      control: displayForm.control,
      errors: displayForm.formState.errors,
      connectionType,
      language,
      paper,
      onChangePaper: driverConfig.onChangePaper,
      deviceInfo,
      status: liveStatus,
      autoReconnect,
      onAutoReconnectChange: setAutoReconnect,
      testPrintPending: testPrint.testPrintPending,
      onTestPrint: testPrint.onTestPrint,
      onSelectRenderMode: driverConfig.onSelectRenderMode,
      onSelectRasterSource: driverConfig.onSelectRasterSource,
      testPrintRowsText: testPrint.testPrintRowsText,
      onTestPrintRowsChange: testPrint.setTestPrintRowsText,
      kind,
      onSave,
      saveDisabled: !language || connectionDirty || hasDieCutMediaError,
      locked: !language,
    },
  };
};
