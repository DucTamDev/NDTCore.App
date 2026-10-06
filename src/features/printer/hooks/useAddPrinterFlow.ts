import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { printerRepository } from '../storage/PrinterRepository';
import type { PrinterWriteInput } from '../storage/PrinterWriteInput';
import { printerConnectionService } from '../connection/PrinterConnectionService';
import { usePrintImageCapture } from './usePrintImageCapture';
import { generateId } from '../../../utils/id';
import { printerDisplaySchema, type PrinterDisplayValues } from '../forms/addPrinter/PrinterDisplaySchema';
import type { ConnectionSectionProps } from '../components/ConnectionSection';
import type { StatusPanelProps, ConnectionState, LanguageState } from '../components/StatusPanel';
import type { PrinterInfoCardProps } from '../components/PrinterInfoCard';
import { ConnectionType } from '../models/printer/ConnectionType';
import { LanguageSelection, PrintLanguage } from '../models/printer/PrinterLanguage';
import type { PrinterLanguage } from '../models/printer/PrinterLanguage';
import { PrinterConnectionStatus } from '../models/printer/PrinterConnectionStatus';
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
import type { PrinterConnection } from '../models/printer/PrinterConnection';
import { useConnectionSetup } from './addPrinter/useConnectionSetup';
import { usePrinterDetection } from './addPrinter/usePrinterDetection';
import type { PrinterDetection } from '../detection/PrinterDetection';
import { useTestPrint } from './addPrinter/useTestPrint';
import { deviceIdOf } from '../models/printer/PrinterConnection';
import { usePrintSettings } from './addPrinter/usePrintSettings';

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

/** Giá trị tạm để bản nháp đủ kiểu `Printer` trước khi biết ngôn ngữ; kết nối và dò ngôn ngữ không đọc field này. */
const PLACEHOLDER_LANGUAGE: PrinterLanguage = createPrinterLanguage(PrintLanguage.EscPos, LanguageSelection.Auto);

/**
 * Toàn bộ orchestration của luồng Thêm/Sửa máy in — tìm thiết bị, dò ngôn ngữ, dựng draft,
 * in thử, lưu. Tách khỏi `AddPrinterModal` để component chỉ còn render + wiring.
 *
 * Coordinator sở hữu state chồng lấn (`language`, `paper`, `displayForm`, `autoReconnect`,
 * `buildDraftPrinter`, vòng đời kết nối) và ghép 4 hook con dưới `addPrinter/`:
 * `useConnectionSetup`, `usePrinterDetection`, `useTestPrint`, `usePrintSettings`.
 */
export const useAddPrinterFlow = ({ visible, initialValues, onSaved, kind }: UseAddPrinterFlowInput): UseAddPrinterFlow => {
  const printerId = useMemo(() => initialValues?.id ?? generateId(), [initialValues?.id]);
  const [autoReconnect, setAutoReconnect] = useState(initialValues?.autoReconnect ?? true);
  const [language, setLanguage] = useState<PrinterLanguage | undefined>(initialValues?.language);
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const { captureNode, captureImage } = usePrintImageCapture();
  const [liveStatus, setLiveStatus] = useState<PrinterConnectionStatus>(PrinterConnectionStatus.Idle);

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
  const connectionRef = useRef<{ connectionState: ConnectionState; language?: PrinterLanguage }>({
    connectionState: initialValues ? 'connected' : 'idle',
    language: initialValues?.language,
  });
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
    printerId,
    kind,
    hasLanguage: Boolean(language),
    getConnectionState: () => detectionRef.current.connectionState,
    getLanguageState: () => detectionRef.current.languageState,
    resetConnectionResult: () => detectionRef.current.resetConnectionResult(),
  });
  const { connectionType, selectedDevice, lanForm, buildLan, currentIdentityKey, identityErrorMessage } = connectionSetup;

  const buildConnection = (): PrinterConnection => {
    if (connectionType === ConnectionType.Lan) {
      const { ip, port } = buildLan(lanForm.getValues());
      return { type: ConnectionType.Lan, host: ip, port };
    }

    if (selectedDevice) {
      return selectedDevice.connection;
    }

    return connectionType === ConnectionType.Usb
      ? { type: ConnectionType.Usb, vendorId: 0, productId: 0 }
      : { type: ConnectionType.Bluetooth, mac: '' };
  };

  /**
   * Bản nháp phải đủ field vì kết nối, dò ngôn ngữ và in thử đều nhận `Printer`. `PLACEHOLDER_LANGUAGE` không
   * ảnh hưởng lúc dò; chỉ có nghĩa khi đã xác định ngôn ngữ, lúc in thử hoặc lưu.
   */
  const buildDraftPrinter = (): PrinterWriteInput => {
    const draft = createPrinterDraft({
      id: printerId,
      kind,
      connection: buildConnection(),
      language: language ?? PLACEHOLDER_LANGUAGE,
    });

    return {
      ...draft,
      name: displayForm.getValues('name') || draft.name,
      vendor: initialValues?.vendor ?? detection?.vendor ?? selectedDevice?.device.manufacturer,
      model: initialValues?.model ?? detection?.model ?? selectedDevice?.device.model,
      deviceId: currentIdentityKey() ?? undefined,
      capabilities: initialValues?.capabilities ?? detection?.capabilities ?? draft.capabilities,
      // Kết nối và dò ngôn ngữ không phụ thuộc giấy; Lưu và In thử bị chặn khi giấy tem còn thiếu kích thước.
      paper: toPaperOptions(paperForm.getValues()) ?? DEFAULT_PAPER,
      autoReconnect,
      enabled: initialValues?.enabled ?? true,
      createdAt: initialValues?.createdAt ?? draft.createdAt,
    };
  };

  /**
   * `useTestPrint`/`usePrinterDetection` cần `Printer` đủ — `?? ''` chỉ là fallback kiểu, không chạm tới trên thực tế
   * khi đã có device/LAN hợp lệ.
   */
  const buildFullDraftPrinter = (): Printer => {
    const draft = buildDraftPrinter();
    return { ...draft, deviceId: draft.deviceId ?? '' };
  };

  /**
   * Điền sẵn "Tên hiển thị" bằng tên thiết bị khi kết nối — chỉ khi ô còn TRỐNG.
   */
  const prefillDisplayName = (): void => {
    if (displayForm.getValues('name')) {
      return;
    }

    const lanIp = connectionType === ConnectionType.Lan ? lanForm.getValues('lanIp') : undefined;
    displayForm.setValue(
      'name',
      selectedDevice?.device.name || (lanIp ? `Máy in ${lanIp}` : 'Máy in mới'),
    );
  };

  const testPrint = useTestPrint({
    language,
    paperError,
    displayForm,
    buildDraftPrinter: buildFullDraftPrinter,
    captureImage,
  });
  usePrintSettings({ printerId, paperForm });

  const printerDetection = usePrinterDetection({
    initialValues,
    connectionType,
    selectedDevice,
    lanForm,
    cancelConnectRef,
    buildDraftPrinter: buildFullDraftPrinter,
    setLanguage,
    setDetection,
    refreshUsbSerial: connectionSetup.refreshUsbSerial,
    prefillDisplayName,
  });
  detectionRef.current = {
    connectionState: printerDetection.connectionState,
    languageState: printerDetection.languageState,
    resetConnectionResult: printerDetection.resetConnectionResult,
  };
  const { connectionState, languageState, connectionDirty } = printerDetection;

  useEffect(() => {
    connectionRef.current = { connectionState, language };
  }, [connectionState, language]);

  useEffect(() => {
    if (!language) {
      setLiveStatus(PrinterConnectionStatus.Idle);
      return undefined;
    }

    setLiveStatus(printerConnectionService.getStatus(printerId));
    return printerConnectionService.onStatusChange(printerId, setLiveStatus);
  }, [language, printerId]);

  useEffect(() => {
    if (!visible) {
      cancelConnectRef.current?.();
      cancelConnectRef.current = null;
      const current = connectionRef.current;
      if (current.connectionState === 'connected' && current.language && !savedRef.current) {
        printerConnectionService.disconnect(printerId).catch(() => undefined);
      }
    }
    return () => {
      cancelConnectRef.current?.();
    };
  }, [visible, printerId]);

  // Trên phone, `PrinterManagementPanel` unmount `AddPrinterForm` khi backToList
  // với `visible` vẫn `true` → nhánh `!visible` ở trên không chạy.
  useEffect(
    () => () => {
      const current = connectionRef.current;
      if (current.connectionState === 'connected' && current.language && !savedRef.current) {
        printerConnectionService.disconnect(printerId).catch(() => undefined);
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
        printerRepository.updatePrinter(printer);
      } else {
        printerRepository.addPrinter(printer);
      }
    } catch (error) {
      setSaveErrorMessage(error instanceof Error ? error.message : 'Lưu máy in thất bại');
      return;
    }
    savedRef.current = true;
    if (liveStatus === PrinterConnectionStatus.Connected) {
      printerConnectionService.reconnect(printer.id).catch(() => undefined);
    } else if (printer.autoReconnect) {
      const saved = printerRepository.findById(printer.id);

      if (saved) {
        printerConnectionService.connect(saved).catch(() => undefined);
      }
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
      selectedConnectionKey: selectedDevice ? deviceIdOf(selectedDevice.connection) : undefined,
      selectedScanId: selectedDevice?.device.deviceId,
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
      disabled: Boolean(language),
    },
    statusPanel: {
      connectionState,
      languageState,
      languageType: printerDetection.languageType,
      device: selectedDevice?.device,
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
      device: selectedDevice?.device,
      status: liveStatus,
      autoReconnect,
      onAutoReconnectChange: setAutoReconnect,
      testPrintPending: testPrint.testPrintPending,
      onTestPrint: testPrint.onTestPrint,
      testPrintRowsText: testPrint.testPrintRowsText,
      onTestPrintRowsChange: testPrint.setTestPrintRowsText,
      kind,
      onSave,
      saveDisabled: !language || connectionDirty || hasDieCutMediaError,
      locked: !language,
    },
  };
};
