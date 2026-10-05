import { useState, type MutableRefObject } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import {
  printerDetectionService,
  PrinterDetectionStage,
  type PrinterDetectionEvent,
} from '../../detection/PrinterDetectionService';
import { printerConnectionService } from '../../connection/PrinterConnectionService';
import { createPrinterLanguage } from '../../management/PrinterDefaults';
import type { ConnectionState, LanguageState } from '../../components/StatusPanel';
import { ConnectionType } from '../../models/printer/ConnectionType';
import { LanguageSelection, type PrinterLanguage, type PrintLanguage } from '../../models/printer/PrinterLanguage';
import type { Printer } from '../../models/printer/Printer';
import type { LanConnectionValues } from '../../forms/addPrinter/LanConnectionSchema';

/**
 * Input cho {@link usePrinterDetection}. `buildDraftPrinter`/`setLanguage`/`refreshUsbSerial`/`prefillDisplayName`
 * do coordinator / {@link useConnectionSetup} sở hữu — hook này chỉ điều phối trạng thái kết nối và dò ngôn ngữ.
 */
export interface UsePrinterDetectionInput {
  initialValues?: Printer;

  connectionType: ConnectionType;

  lanForm: UseFormReturn<LanConnectionValues>;

  /** Huỷ lần dò đang chạy; coordinator gọi khi đóng modal. */
  detectionUnsubscribeRef: MutableRefObject<(() => void) | null>;

  buildDraftPrinter: () => Printer;

  setLanguage: (language: PrinterLanguage) => void;

  refreshUsbSerial: () => Promise<void>;

  prefillDisplayName: () => void;
}

/**
 * Trạng thái kết nối + dò ngôn ngữ của luồng Thêm/Sửa máy in: bấm "Kết nối" → `PrinterDetectionService.detect`,
 * và nhánh chọn ngôn ngữ thủ công qua `PrinterConnectionService.connect`.
 */
export const usePrinterDetection = ({
  initialValues,
  connectionType,
  lanForm,
  detectionUnsubscribeRef,
  buildDraftPrinter,
  setLanguage,
  refreshUsbSerial,
  prefillDisplayName,
}: UsePrinterDetectionInput) => {
  const [connectionDirty, setConnectionDirty] = useState(!initialValues);
  const [connectionState, setConnectionState] = useState<ConnectionState>(initialValues ? 'connected' : 'idle');
  const [languageState, setLanguageState] = useState<LanguageState>(initialValues ? 'identified' : 'idle');
  const [languageType, setLanguageType] = useState<PrintLanguage | undefined>(initialValues?.language.type);
  const [connectionErrorMessage, setConnectionErrorMessage] = useState<string | undefined>(undefined);

  const resetDetectionFields = (nextConnectionState: ConnectionState): void => {
    setConnectionState(nextConnectionState);
    setLanguageState('idle');
    setConnectionErrorMessage(undefined);
    setConnectionDirty(true);
  };

  const resetConnectionResult = (): void => {
    detectionUnsubscribeRef.current?.();
    detectionUnsubscribeRef.current = null;
    resetDetectionFields('idle');
  };

  /** Đã kết nối và biết ngôn ngữ (tự dò hoặc người dùng chọn). */
  const applyLanguage = (language: PrinterLanguage): void => {
    setConnectionState('connected');
    setLanguageState('identified');
    setLanguageType(language.type);
    setConnectionDirty(false);
    setLanguage(language);
    refreshUsbSerial();
    prefillDisplayName();
  };

  const onDetectionEvent = (event: PrinterDetectionEvent): void => {
    switch (event.stage) {
      case PrinterDetectionStage.Identifying:
        setLanguageState('detecting');
        break;
      case PrinterDetectionStage.Detected:
        applyLanguage(event.language);
        break;
      case PrinterDetectionStage.Unknown:
        setConnectionState('idle');
        setLanguageState('unknown');
        break;
      case PrinterDetectionStage.Error:
        setConnectionState('error');
        setLanguageState('idle');
        setConnectionErrorMessage(event.error.message);
        break;
      default:
        break;
    }
  };

  const startDetection = (): void => {
    resetDetectionFields('connecting');
    const draftPrinter = buildDraftPrinter();
    detectionUnsubscribeRef.current = printerDetectionService.detect({ draftPrinter }, onDetectionEvent);
  };

  const onConnectPress = (): void => {
    if (connectionType === ConnectionType.Lan) {
      lanForm.handleSubmit(() => startDetection())();
    } else {
      startDetection();
    }
  };

  const onChooseLanguage = (chosenLanguage: PrintLanguage): void => {
    setConnectionState('connecting');
    setLanguageState('detecting');
    const language = createPrinterLanguage(chosenLanguage, LanguageSelection.Manual);

    printerConnectionService.connect({ ...buildDraftPrinter(), language })
      .then(() => applyLanguage(language))
      .catch((error: { message: string }) => {
        setConnectionState('error');
        setLanguageState('idle');
        setConnectionErrorMessage(error.message);
      });
  };

  return {
    connectionState,
    languageState,
    languageType,
    connectionErrorMessage,
    connectionDirty,
    resetConnectionResult,
    onConnectPress,
    onChooseLanguage,
  };
};
