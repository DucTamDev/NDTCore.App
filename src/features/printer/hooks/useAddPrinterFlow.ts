import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { printerManagementService } from '../management/PrinterManagementService';
import { printerRepository } from '../storage/PrinterRepository';
import type { ConnectedDevice } from '../models/device/ConnectedDevice';
import { printerConnectionService } from '../connection/PrinterConnectionService';
import { usePrintImageCapture } from './usePrintImageCapture';
import { generateId } from '../../../utils/id';
import { printerDisplaySchema, type PrinterDisplayValues } from '../forms/addPrinter/PrinterDisplaySchema';
import type { ConnectionSectionProps } from '../components/ConnectionSection';
import type { StatusPanelProps, ConnectionState, LanguageState } from '../components/StatusPanel';
import type { PrinterInfoCardProps } from '../components/PrinterInfoCard';
import { ConnectionType } from '../models/connections/ConnectionType';
import { LanguageSelection, PrintLanguage } from '../models/printer/PrinterLanguage';
import type { PrinterLanguage } from '../models/printer/PrinterLanguage';
import { ConnectionStatus } from '../models/connections/ConnectionStatus';
import type { PrintKind } from '../models/printer/PrintKind';
import { createPrinterDraft, createPrinterLanguage, DEFAULT_PAPER } from '../management/PrinterDefaults';
import {
  paperFormErrorOf,
  paperFormSchema,
  toPaperFormValues,
  toPaperOptions,
  type PaperFormValues,
} from '../forms/addPrinter/PaperFormSchema';
import type { PaperOptions } from '../models/paper/PaperOptions';
import type { Printer } from '../models/printer/Printer';
import type { DeviceAddress } from '../models/device/DeviceAddress';
import { useConnectionSetup } from './addPrinter/useConnectionSetup';
import { usePrinterDetection } from './addPrinter/usePrinterDetection';
import type { PrinterDetection } from '../detection/PrinterDetection';
import { useTestPrint } from './addPrinter/useTestPrint';

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

/** Thông báo khi đã có máy in khác (khác `printerId`) cùng máy vật lý và cùng loại nội dung. */
const duplicatePrinterMessage = (
  deviceId: string | undefined,
  printerId: string,
  kind: PrintKind,
): string | undefined => {
  const collision = deviceId
    ? printerRepository.getPrinters().find((p) => p.id !== printerId && p.deviceId === deviceId && p.kind === kind)
    : undefined;
  return collision ? `Máy in này đã được thêm cho loại nội dung này với tên "${collision.name}".` : undefined;
};

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

/** Giá trị tạm để bản nháp đủ kiểu `Printer` trước khi biết ngôn ngữ; kết nối và dò ngôn ngữ không đọc field này. */
const PLACEHOLDER_LANGUAGE: PrinterLanguage = createPrinterLanguage(PrintLanguage.EscPos, LanguageSelection.Auto);

/**
 * Toàn bộ orchestration của luồng Thêm/Sửa máy in — tìm thiết bị, dò ngôn ngữ, dựng draft,
 * in thử, lưu. Tách khỏi `AddPrinterModal` để component chỉ còn render + wiring.
 *
 * Coordinator sở hữu state chồng lấn (`language`, `paper`, `displayForm`,
 * `buildDraftPrinter`, vòng đời kết nối) và ghép 3 hook con dưới `addPrinter/`:
 * `useConnectionSetup`, `usePrinterDetection`, `useTestPrint`.
 */
export const useAddPrinterFlow = ({ visible, initialValues, onSaved, kind }: UseAddPrinterFlowInput): UseAddPrinterFlow => {
  const printerId = useMemo(() => initialValues?.id ?? generateId(), [initialValues?.id]);
  const [language, setLanguage] = useState<PrinterLanguage | undefined>(initialValues?.language);
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const { captureNode, captureImage } = usePrintImageCapture();
  const [liveStatus, setLiveStatus] = useState<ConnectionStatus>(ConnectionStatus.Idle);

  const displayForm = useForm<PrinterDisplayValues>({
    resolver: zodResolver(printerDisplaySchema),
    defaultValues: {
      name: initialValues?.name ?? '',
    },
  });

  const paperForm = useForm<PaperFormValues, unknown, PaperOptions>({
    resolver: zodResolver(paperFormSchema),
    mode: 'onChange',
    defaultValues: toPaperFormValues(initialValues?.paper ?? DEFAULT_PAPER),
  });
  const paperError = paperFormErrorOf(paperForm.watch());

  const cancelConnectRef = useRef<(() => void) | null>(null);
  const [detection, setDetection] = useState<PrinterDetection | undefined>(undefined);
  const savedRef = useRef(false);

  /** Form đã tự mở kết nối (bấm Kết nối / chọn ngôn ngữ); chỉ khi đó đóng form mới phải trả máy in về như cũ. */
  const connectionTouchedRef = useRef(false);

  /** Máy đang sửa có đang kết nối lúc mở form không; Huỷ thì kết nối lại bằng cấu hình đã lưu thay vì ngắt. */
  const [restoreOnCancel] = useState(
    () => Boolean(initialValues) && printerConnectionService.getStatus(printerId) === ConnectionStatus.Connected,
  );
  // Bridge để `useConnectionSetup` đọc state của `usePrinterDetection` tại thời
  // điểm handler chạy — phá vòng phụ thuộc giữa 2 hook con.
  const detectionRef = useRef<{
    connectionState: ConnectionState;
    languageState: LanguageState;
    resetConnectionResult: () => void;
  }>({
    connectionState: initialValues ? 'connected' : 'idle',
    languageState: initialValues ? 'identified' : 'idle',
    resetConnectionResult: () => undefined,
  });

  const connectionSetup = useConnectionSetup({
    initialValues,
    hasLanguage: Boolean(language),
    getConnectionState: () => detectionRef.current.connectionState,
    getLanguageState: () => detectionRef.current.languageState,
    resetConnectionResult: () => detectionRef.current.resetConnectionResult(),
  });
  const { connectionType, selectedDevice, lanForm, buildLan } = connectionSetup;

  /** Thông tin native trả ở lần kết nối gần nhất trong form; máy đang sửa chưa kết nối lại trong form thì chưa có. */
  const [connectedDevice, setConnectedDevice] = useState<ConnectedDevice | undefined>(undefined);

  /** Trùng chỉ biết được sau khi kết nối, vì định danh máy do native trả. */
  const identityErrorMessage = useMemo(
    () => duplicatePrinterMessage(connectedDevice?.deviceId, printerId, kind),
    [connectedDevice, printerId, kind],
  );

  const buildConnection = (): DeviceAddress => {
    if (connectedDevice) {
      return connectedDevice.address;
    }

    if (connectionType === ConnectionType.Lan) {
      const { ip, port } = buildLan(lanForm.getValues());
      return { type: ConnectionType.Lan, host: ip, port };
    }

    if (selectedDevice) {
      return selectedDevice.address;
    }

    return connectionType === ConnectionType.Usb
      ? { type: ConnectionType.Usb, vendorId: 0, productId: 0 }
      : { type: ConnectionType.Bluetooth, mac: '' };
  };

  /**
   * Bản nháp phải đủ field vì kết nối, dò ngôn ngữ và in thử đều nhận `Printer`. `PLACEHOLDER_LANGUAGE` không
   * ảnh hưởng lúc dò; chỉ có nghĩa khi đã xác định ngôn ngữ, lúc in thử hoặc lưu.
   */
  const buildDraftPrinter = (): Printer => {
    const draft = createPrinterDraft({
      id: printerId,
      kind,
      connection: buildConnection(),
      language: language ?? PLACEHOLDER_LANGUAGE,
    });

    return {
      ...draft,
      name: displayForm.getValues('name') || draft.name,
      vendor:
        initialValues?.vendor ?? detection?.vendor ?? connectedDevice?.manufacturer ?? selectedDevice?.manufacturer,
      model: initialValues?.model ?? detection?.model ?? connectedDevice?.model ?? selectedDevice?.model,
      deviceId: connectedDevice?.deviceId ?? initialValues?.deviceId ?? '',
      capabilities: initialValues?.capabilities ?? detection?.capabilities ?? draft.capabilities,
      // Kết nối và dò ngôn ngữ không phụ thuộc giấy; Lưu và In thử bị chặn khi giấy tem còn thiếu kích thước.
      paper: toPaperOptions(paperForm.getValues()) ?? DEFAULT_PAPER,
      enabled: initialValues?.enabled ?? true,
      createdAt: initialValues?.createdAt ?? draft.createdAt,
    };
  };

  /** Điền sẵn "Tên hiển thị" bằng tên thiết bị khi kết nối, chỉ khi ô còn trống. */
  const prefillDisplayName = (deviceName: string | undefined): void => {
    if (displayForm.getValues('name')) {
      return;
    }

    const lanIp = connectionType === ConnectionType.Lan ? lanForm.getValues('lanIp') : undefined;
    displayForm.setValue('name', deviceName || (lanIp ? `Máy in ${lanIp}` : 'Máy in mới'));
  };

  const onConnected = (device: ConnectedDevice): void => {
    setConnectedDevice(device);
    prefillDisplayName(device.name ?? selectedDevice?.name);
  };

  const testPrint = useTestPrint({
    language,
    paperError,
    displayForm,
    buildDraftPrinter,
    captureImage,
  });

  const printerDetection = usePrinterDetection({
    initialValues,
    connectionType,
    selectedDevice,
    lanForm,
    cancelConnectRef,
    buildDraftPrinter,
    setLanguage,
    setDetection,
    onConnectStart: () => {
      connectionTouchedRef.current = true;
    },
    onConnected,
  });
  detectionRef.current = {
    connectionState: printerDetection.connectionState,
    languageState: printerDetection.languageState,
    resetConnectionResult: printerDetection.resetConnectionResult,
  };
  const { connectionState, languageState, connectionDirty } = printerDetection;

  useEffect(() => {
    if (!language) {
      setLiveStatus(ConnectionStatus.Idle);
      return undefined;
    }

    setLiveStatus(printerConnectionService.getStatus(printerId));
    return printerConnectionService.onStatusChange(printerId, setLiveStatus);
  }, [language, printerId]);

  /**
   * Đóng form mà chưa lưu: chỉ khi form đã tự kết nối mới trả máy in về như trước khi mở. Ngắt cũng huỷ lượt kết nối
   * đang chạy dở; máy đang sửa vốn đang kết nối thì kết nối lại bằng cấu hình đã lưu.
   */
  const releaseConnection = useCallback((): void => {
    if (savedRef.current || !connectionTouchedRef.current) {
      return;
    }

    connectionTouchedRef.current = false;
    const restore = restoreOnCancel
      ? printerConnectionService.reconnect(printerId)
      : printerConnectionService.disconnect(printerId);
    restore.catch(() => undefined);
  }, [printerId, restoreOnCancel]);

  useEffect(() => {
    if (!visible) {
      cancelConnectRef.current?.();
      cancelConnectRef.current = null;
      releaseConnection();
    }
    return () => {
      cancelConnectRef.current?.();
    };
  }, [visible, releaseConnection]);

  // Trên phone, `PrinterManagementPanel` unmount `AddPrinterForm` khi backToList
  // với `visible` vẫn `true` → nhánh `!visible` ở trên không chạy.
  useEffect(() => releaseConnection, [releaseConnection]);

  /** Mở khoá phần kết nối để chọn máy hoặc địa chỉ khác; phải kết nối và xác định ngôn ngữ lại mới lưu được. */
  const onChangeConnection = (): void => {
    setLanguage(undefined);
    setConnectedDevice(undefined);
    setDetection(undefined);
    printerDetection.resetConnectionResult();
  };

  const onSave = displayForm.handleSubmit(() => {
    if (!language) {
      return;
    }

    const printer = buildDraftPrinter();

    try {
      printerManagementService.save(printer);
    } catch (error) {
      setSaveErrorMessage(error instanceof Error ? error.message : 'Lưu máy in thất bại');
      return;
    }
    savedRef.current = true;
    onSaved();
  });

  const connectLabel = resolveConnectLabel(connectionState);
  const connectDisabled =
    connectionState === 'connecting' ||
    (connectionType !== ConnectionType.Lan && !selectedDevice);
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
      selectedScanId: selectedDevice?.deviceId,
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
      onConnectPress: printerDetection.onConnectPress,
      onChangeConnection,
      disabled: Boolean(language),
    },
    statusPanel: {
      connectionState,
      languageState,
      languageType: printerDetection.languageType,
      device: selectedDevice,
      errorMessage: printerDetection.connectionErrorMessage,
      kind,
      onChooseLanguage: printerDetection.onChooseLanguage,
    },
    infoCard: {
      control: displayForm.control,
      errors: displayForm.formState.errors,
      connectionType,
      language,
      paperForm,
      device: selectedDevice,
      status: liveStatus,
      testPrintPending: testPrint.testPrintPending,
      onTestPrint: testPrint.onTestPrint,
      testPrintRowsText: testPrint.testPrintRowsText,
      onTestPrintRowsChange: testPrint.setTestPrintRowsText,
      kind,
      onSave,
      saveDisabled: !language || connectionDirty || hasDieCutMediaError || Boolean(identityErrorMessage),
      locked: !language,
    },
  };
};
