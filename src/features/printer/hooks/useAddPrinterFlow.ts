import { useEffect, useState } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import {
  PrinterError,
  PrinterErrorCode,
  printerManager,
  printerSetup,
  TransportType,
  type DeviceCandidate,
  type FieldError,
  type Printer,
  type PrinterKind,
  type PrinterManager,
  type PrinterSetupService,
} from '@ndtcore/printer';
import { getCurrentWifiIp } from '../discovery/NetworkDiscoveryService';
import {
  applyFieldErrors,
  configUpdateOf,
  defaultFormValuesOf,
  fieldMessageOf,
  formValuesOf,
  type PrinterConfigFormValues,
} from '../forms/addPrinter/PrinterConfigForm';
import { printerErrorMessageOf } from '../errors/PrinterErrorMessages';
import {
  usePrinterSetupSession,
  type UsePrinterSetupSession,
} from './addPrinter/usePrinterSetupSession';
import { useTestPrint, type UseTestPrint } from './addPrinter/useTestPrint';

/** Đầu vào của luồng thêm, sửa máy in. */
export interface UseAddPrinterFlowInput {
  /** Loại nội dung cố định: tab đang mở lúc thêm, kind của máy lúc sửa. */
  kind: PrinterKind;

  /** Máy đã lưu khi sửa; không có là thêm mới. */
  initialPrinter?: Printer;

  /** Lưu xong. */
  onSaved: () => void;

  /** Phụ thuộc của package; test truyền bản giả. */
  dependencies?: { setup?: PrinterSetupService; manager?: PrinterManager };
}

/** Ô IP, cổng LAN: kết nối máy mới hoặc đổi địa chỉ máy đã lưu. */
export interface LanAddressState {
  /** IP đang nhập. */
  host: string;

  /** Cổng đang nhập. */
  port: string;

  /** Lỗi của IP. */
  hostError?: string;

  /** Lỗi của cổng. */
  portError?: string;

  /** IP Wi-Fi của máy bán hàng, để gợi ý dải mạng. */
  detectedIp: string | null;

  /** Không lấy được IP Wi-Fi. */
  fetchError?: string;

  /** Đổi IP. */
  setHost: (value: string) => void;

  /** Đổi cổng. */
  setPort: (value: string) => void;

  /** Lấy IP Wi-Fi của máy bán hàng. */
  fetchIpAsync: () => Promise<void>;

  /** Điền IP Wi-Fi vừa lấy. */
  fillDetectedIp: () => void;
}

/** Trạng thái và thao tác của form thêm, sửa máy in. */
export interface UseAddPrinterFlow {
  /** Tiêu đề form. */
  title: string;

  /** Đang sửa máy đã lưu. */
  isEdit: boolean;

  /** Phiên tìm, kết nối máy (chỉ dùng khi thêm). */
  session: UsePrinterSetupSession;

  /** Máy đang chọn trong danh sách tìm được. */
  selectedCandidate?: DeviceCandidate;

  /** Chọn máy trong danh sách. */
  selectCandidate: (candidate: DeviceCandidate) => void;

  /** Kết nối máy đang chọn hoặc địa chỉ LAN đang nhập. */
  connectAsync: () => Promise<void>;

  /** Ô IP, cổng LAN. */
  lan: LanAddressState;

  /** Máy làm gốc của form: bản nháp khi thêm, máy đã lưu khi sửa; chưa kết nối thì undefined. */
  basePrinter?: Printer;

  /** Form cấu hình in. */
  form: UseFormReturn<PrinterConfigFormValues>;

  /** In thử. */
  testPrint: UseTestPrint;

  /** In thử theo cấu hình đang nhập, không lưu. */
  testPrintAsync: () => Promise<void>;

  /** Lưu: thêm máy mới hoặc cập nhật máy đã lưu. */
  saveAsync: () => Promise<void>;

  /** Đang lưu. */
  saving: boolean;

  /** Lỗi lưu không gắn được vào ô nào. */
  saveErrorMessage: string | null;

  /** Ẩn lỗi lưu. */
  clearSaveError: () => void;
}

/** Khoá phân biệt ứng viên: path USB, MAC Bluetooth. */
export const candidateKeyOf = (candidate: DeviceCandidate): string =>
  candidate.transportType === TransportType.Lan
    ? `${candidate.host}:${candidate.port}`
    : candidate.transportType === TransportType.Usb
    ? candidate.device.path
    : candidate.device.mac;

/** Câu lỗi chung của lỗi package. */
const messageOf = (error: unknown): string =>
  printerErrorMessageOf(
    error instanceof PrinterError ? error.code : PrinterErrorCode.InternalError,
  );

/** Lỗi theo trường của IP, cổng. */
const lanErrorOf = (
  errors: FieldError[],
  field: 'host' | 'port',
): string | undefined => {
  const found = errors.find(error => error.field === field);
  return found ? fieldMessageOf(found.reason) : undefined;
};

/** Địa chỉ LAN đã lưu của máy, để biết người dùng có đổi IP, cổng không. */
const savedLanOf = (printer?: Printer): { host: string; port: string } => {
  const config = printer?.connectionConfig;
  return config?.transportType === TransportType.Lan
    ? { host: config.host, port: String(config.port) }
    : { host: '', port: '9100' };
};

/**
 * Luồng thêm, sửa máy in. Thêm: tìm, kết nối qua printerSetup, form cấu hình bản nháp, lưu bằng saveAsync. Sửa: form
 * cấu hình máy đã lưu, đổi IP máy LAN bằng updateLanAddressAsync, lưu bằng updateAsync. In thử dùng bản withConfig.
 */
export const useAddPrinterFlow = (
  input: UseAddPrinterFlowInput,
): UseAddPrinterFlow => {
  const { kind, initialPrinter, onSaved, dependencies } = input;
  const setup = dependencies?.setup ?? printerSetup;
  const manager = dependencies?.manager ?? printerManager;
  const isEdit = Boolean(initialPrinter);
  const session = usePrinterSetupSession(kind, { enabled: !isEdit, setup });
  const testPrint = useTestPrint();
  const savedLan = savedLanOf(initialPrinter);
  const [selectedCandidate, setSelectedCandidate] = useState<
    DeviceCandidate | undefined
  >(undefined);
  const [lanHost, setLanHost] = useState(savedLan.host);
  const [lanPort, setLanPort] = useState(savedLan.port);
  const [lanErrors, setLanErrors] = useState<FieldError[]>([]);
  const [detectedIp, setDetectedIp] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const form = useForm<PrinterConfigFormValues>({
    defaultValues: initialPrinter
      ? formValuesOf(initialPrinter.config)
      : defaultFormValuesOf(kind),
  });
  const basePrinter = initialPrinter ?? session.draft;
  const { draft } = session;
  const { reset } = form;

  // Mỗi lần kết nối được máy, form lấy cấu hình mặc định và lang dò được của bản nháp.
  useEffect(() => {
    if (draft) {
      reset(formValuesOf(draft.config));
    }
  }, [draft, reset]);

  const selectCandidate = (candidate: DeviceCandidate): void => {
    setSelectedCandidate(candidate);
    session.resetConnection();
  };

  const connectAsync = async (): Promise<void> => {
    if (session.transport === TransportType.Lan) {
      await session.connectLanAsync(lanHost, Number(lanPort));
      return;
    }

    if (selectedCandidate) {
      await session.connectAsync(selectedCandidate);
    }
  };

  /** Bản withConfig theo form; sai thì gắn lỗi vào ô và trả undefined. */
  const copyFromForm = (): Printer | undefined => {
    if (!basePrinter) {
      return undefined;
    }

    form.clearErrors();
    try {
      return basePrinter.withConfig(configUpdateOf(form.getValues(), kind));
    } catch (error) {
      showError(error);
      return undefined;
    }
  };

  /** Lỗi theo trường gắn vào ô; lỗi khác hiện ở thông báo lưu. */
  const showError = (error: unknown): void => {
    if (error instanceof PrinterError && error.fieldErrors) {
      const rest = applyFieldErrors(error.fieldErrors, form.setError);

      if (rest.length > 0) {
        setSaveErrorMessage(messageOf(error));
      }

      return;
    }

    setSaveErrorMessage(messageOf(error));
  };

  const testPrintAsync = async (): Promise<void> => {
    const copy = copyFromForm();

    if (copy) {
      await testPrint.testPrintAsync(copy);
    }
  };

  /** Đổi địa chỉ máy LAN đã lưu nếu người dùng sửa IP, cổng; false khi địa chỉ mới sai. */
  const updateLanAddressAsync = async (printer: Printer): Promise<boolean> => {
    if (printer.connectionConfig.transportType !== TransportType.Lan) {
      return true;
    }

    if (lanHost === savedLan.host && lanPort === savedLan.port) {
      return true;
    }

    setLanErrors([]);
    try {
      await manager.updateLanAddressAsync(printer.id, lanHost, Number(lanPort));
      return true;
    } catch (error) {
      if (error instanceof PrinterError && error.fieldErrors) {
        setLanErrors(error.fieldErrors);
        return false;
      }

      throw error;
    }
  };

  const saveAsync = async (): Promise<void> => {
    const copy = copyFromForm();

    if (!copy) {
      return;
    }

    setSaving(true);
    setSaveErrorMessage(null);
    try {
      if (initialPrinter) {
        if (!(await updateLanAddressAsync(initialPrinter))) {
          return;
        }

        await manager.updateAsync(copy);
      } else {
        await setup.saveAsync(copy);
      }

      onSaved();
    } catch (error) {
      showError(error);
    } finally {
      setSaving(false);
    }
  };

  const fetchIpAsync = async (): Promise<void> => {
    setFetchError(undefined);
    const ip = await getCurrentWifiIp();
    setDetectedIp(ip);

    if (!ip) {
      setFetchError('Không lấy được IP, kiểm tra máy đã kết nối Wi-Fi chưa');
    }
  };

  const allLanErrors = [...lanErrors, ...session.lanFieldErrors];

  return {
    title: isEdit ? 'Chỉnh sửa máy in' : 'Thêm máy in',
    isEdit,
    session,
    selectedCandidate,
    selectCandidate,
    connectAsync,
    lan: {
      host: lanHost,
      port: lanPort,
      hostError: lanErrorOf(allLanErrors, 'host'),
      portError: lanErrorOf(allLanErrors, 'port'),
      detectedIp,
      fetchError,
      setHost: setLanHost,
      setPort: setLanPort,
      fetchIpAsync,
      fillDetectedIp: () => detectedIp && setLanHost(detectedIp),
    },
    basePrinter,
    form,
    testPrint,
    testPrintAsync,
    saveAsync,
    saving,
    saveErrorMessage,
    clearSaveError: () => setSaveErrorMessage(null),
  };
};
