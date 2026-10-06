import { useRef, useState, type MutableRefObject } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { printerDetectionService } from '../../detection/PrinterDetectionService';
import type { PrinterDetection } from '../../detection/PrinterDetection';
import { printerConnectionService } from '../../connection/PrinterConnectionService';
import { createPrinterLanguage } from '../../management/PrinterDefaults';
import { canPrintKind } from '../../forms/addPrinter/printerRules';
import type { ConnectionState, LanguageState } from '../../components/StatusPanel';
import { ConnectionType } from '../../models/printer/ConnectionType';
import { LanguageSelection, type PrinterLanguage, type PrintLanguage } from '../../models/printer/PrinterLanguage';
import type { Printer } from '../../models/printer/Printer';
import type { DiscoverResult } from '../../models/discovery/DiscoverResult';
import type { LanConnectionValues } from '../../forms/addPrinter/LanConnectionSchema';

/**
 * Input cho {@link usePrinterDetection}. `buildDraftPrinter`/`setLanguage`/`setDetection`/`refreshUsbSerial`/
 * `prefillDisplayName` do coordinator / {@link useConnectionSetup} sở hữu.
 */
export interface UsePrinterDetectionInput {
  initialValues?: Printer;

  connectionType: ConnectionType;

  /** Thiết bị đang chọn trong danh sách quét; LAN không có. */
  selectedDevice?: DiscoverResult;

  lanForm: UseFormReturn<LanConnectionValues>;

  /** Bỏ kết quả của lần kết nối đang chạy; coordinator gọi khi đóng modal. */
  cancelConnectRef: MutableRefObject<(() => void) | null>;

  buildDraftPrinter: () => Printer;

  setLanguage: (language: PrinterLanguage) => void;

  /** Model tra được trong bảng máy in; `undefined` khi không có trong bảng. */
  setDetection: (detection: PrinterDetection | undefined) => void;

  refreshUsbSerial: () => Promise<void>;

  prefillDisplayName: () => void;
}

/**
 * Bấm "Kết nối": tra bảng máy in theo thiết bị đã chọn. Có trong bảng thì kết nối bằng ngôn ngữ của model; không có
 * (luôn vậy với LAN) thì để người dùng chọn ngôn ngữ, rồi mới kết nối qua `PrinterConnectionService`.
 */
export const usePrinterDetection = ({
  initialValues,
  connectionType,
  selectedDevice,
  lanForm,
  cancelConnectRef,
  buildDraftPrinter,
  setLanguage,
  setDetection,
  refreshUsbSerial,
  prefillDisplayName,
}: UsePrinterDetectionInput) => {
  const [connectionDirty, setConnectionDirty] = useState(!initialValues);
  const [connectionState, setConnectionState] = useState<ConnectionState>(initialValues ? 'connected' : 'idle');
  const [languageState, setLanguageState] = useState<LanguageState>(initialValues ? 'identified' : 'idle');
  const [languageType, setLanguageType] = useState<PrintLanguage | undefined>(initialValues?.language.type);
  const [connectionErrorMessage, setConnectionErrorMessage] = useState<string | undefined>(undefined);

  /** Mỗi lần kết nối một mã; kết quả của lần đã bị bỏ (reset, đóng modal, kết nối lần khác) không được áp vào. */
  const connectRunRef = useRef(0);

  const cancelConnect = (): void => {
    connectRunRef.current += 1;
  };

  const resetDetectionFields = (nextConnectionState: ConnectionState): void => {
    setConnectionState(nextConnectionState);
    setLanguageState('idle');
    setConnectionErrorMessage(undefined);
    setConnectionDirty(true);
  };

  const resetConnectionResult = (): void => {
    cancelConnect();
    resetDetectionFields('idle');
  };

  /** Đã kết nối và biết ngôn ngữ (tra bảng hoặc người dùng chọn). */
  const applyLanguage = (language: PrinterLanguage): void => {
    setConnectionState('connected');
    setLanguageState('identified');
    setLanguageType(language.type);
    setConnectionDirty(false);
    setLanguage(language);
    refreshUsbSerial();
    prefillDisplayName();
  };

  const connectWith = (language: PrinterLanguage): void => {
    cancelConnect();
    const run = connectRunRef.current;
    cancelConnectRef.current = cancelConnect;
    resetDetectionFields('connecting');
    setLanguageState('detecting');

    printerConnectionService
      .connect({ ...buildDraftPrinter(), language })
      .then(() => {
        if (run === connectRunRef.current) {
          applyLanguage(language);
        }
      })
      .catch((error: { message: string }) => {
        if (run === connectRunRef.current) {
          setConnectionState('error');
          setLanguageState('idle');
          setConnectionErrorMessage(error.message);
        }
      });
  };

  /** Model có ngôn ngữ không in được loại nội dung đang thêm (vd ESC/POS cho tem) thì coi như không tra được. */
  const detectAndConnect = (): void => {
    const found = selectedDevice ? printerDetectionService.detect(selectedDevice) : undefined;
    const detection = found && canPrintKind(found.language.type, buildDraftPrinter().kind) ? found : undefined;
    setDetection(detection);

    if (!detection) {
      resetDetectionFields('idle');
      setLanguageState('unknown');
      return;
    }

    connectWith({ ...detection.language, selection: LanguageSelection.Auto });
  };

  const onConnectPress = (): void => {
    if (connectionType === ConnectionType.Lan) {
      lanForm.handleSubmit(() => detectAndConnect())();
    } else {
      detectAndConnect();
    }
  };

  const onChooseLanguage = (chosenLanguage: PrintLanguage): void => {
    connectWith(createPrinterLanguage(chosenLanguage, LanguageSelection.Manual));
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
