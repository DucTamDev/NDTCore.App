import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import {
  FieldErrorReason,
  LangSource,
  PrinterError,
  PrinterErrorCode,
  PrinterKind,
  PrinterLang,
  printService,
  TransportType,
  type DeviceCandidate,
  type Printer,
  type PrinterConfig,
  type PrinterConfigUpdate,
  type PrinterManager,
  type PrinterSetupService,
} from '@ndtcore/printer';
import {
  useAddPrinterFlow,
  type UseAddPrinterFlow,
  type UseAddPrinterFlowInput,
} from '../useAddPrinterFlow';
import { SampleLabel, SampleReceipt } from '../../components/SamplePrint';

jest.mock('@ndtcore/printer', () => ({
  ...jest.requireActual('@ndtcore/printer'),
  printService: { testPrintAsync: jest.fn(() => Promise.resolve()) },
}));
jest.mock('../../discovery/NetworkDiscoveryService', () => ({
  getCurrentWifiIp: jest.fn(() => Promise.resolve(null)),
}));

const receiptConfig: PrinterConfig = {
  kind: PrinterKind.Receipt,
  name: 'Xprinter XP-80',
  lang: PrinterLang.EscPos,
  langSource: LangSource.Probe,
  capabilities: { hasCutter: true, dpi: 203 },
  paper: { widthMm: 80, cutMode: 'Full', feedLines: 3 },
};

const labelConfig: PrinterConfig = {
  kind: PrinterKind.Label,
  name: 'Tem',
  lang: PrinterLang.Tspl,
  langSource: LangSource.Manual,
  capabilities: { hasCutter: false, dpi: 203 },
  paper: { widthMm: 40, heightMm: 30, columns: 2, columnGapMm: 2, rowGapMm: 2 },
};

/** Printer giả với withConfig ghi lại lời gọi. */
interface FakePrinter {
  /** ID; rỗng với bản nháp. */
  id: string;

  /** Cấu hình in. */
  config: PrinterConfig;

  /** Cách tìm lại máy. */
  connectionConfig: Printer['connectionConfig'];

  /** Hãng, model. */
  deviceInfo: object;

  /** Trạng thái. */
  status: object;

  /** Trả bản sao mang bản cập nhật để test so. */
  withConfig: jest.Mock<FakePrinter, [PrinterConfigUpdate]>;
}

/** Printer giả: withConfig trả bản sao mang bản cập nhật để test so. */
const fakePrinter = (
  config: PrinterConfig,
  connectionConfig: Printer['connectionConfig'],
  id = '',
): FakePrinter => {
  const printer: FakePrinter = {
    id,
    config,
    connectionConfig,
    deviceInfo: {},
    status: { state: 'CONNECTED', actions: [] },
    withConfig: jest.fn((update: PrinterConfigUpdate) => ({
      ...printer,
      config: {
        ...config,
        ...update,
        capabilities: { ...config.capabilities, ...update.capabilities },
        paper: { ...config.paper, ...update.paper },
      },
    })),
  };
  return printer;
};

const usb: DeviceCandidate = {
  transportType: TransportType.Usb,
  displayName: 'Xprinter XP-80',
  device: { path: '/dev/usb/1', vendorId: 1, productId: 2 },
};

const makeSetup = (draft: ReturnType<typeof fakePrinter>) => ({
  start: jest.fn(),
  listUsbDevices: jest.fn(() => [usb]),
  listBluetoothDevicesAsync: jest.fn(() => Promise.resolve([])),
  checkLanAddress: jest.fn(),
  connectAsync: jest.fn(() => Promise.resolve(draft)),
  saveAsync: jest.fn(() => Promise.resolve()),
  cancelAsync: jest.fn(() => Promise.resolve()),
  subscribe: jest.fn(() => jest.fn()),
});

const makeManager = () => ({
  updateAsync: jest.fn(() => Promise.resolve()),
  updateLanAddressAsync: jest.fn(() => Promise.resolve()),
});

const render = (
  input: Omit<UseAddPrinterFlowInput, 'onSaved'>,
  onSaved = jest.fn(),
) => {
  let flow!: UseAddPrinterFlow;
  const Harness: React.FC = () => {
    flow = useAddPrinterFlow({ ...input, onSaved });
    return null;
  };
  act(() => {
    TestRenderer.create(<Harness />);
  });
  return () => flow;
};

/** Thêm máy: chọn máy USB rồi kết nối, trả hàm đọc flow. */
const connectNewAsync = async (
  draft: ReturnType<typeof fakePrinter>,
  kind: PrinterKind = PrinterKind.Receipt,
) => {
  const setup = makeSetup(draft);
  const get = render({
    kind,
    dependencies: { setup: setup as unknown as PrinterSetupService },
  });
  act(() => get().selectCandidate(usb));
  await act(async () => get().connectAsync());
  return { get, setup };
};

beforeEach(() => jest.clearAllMocks());

describe('useAddPrinterFlow: thêm máy', () => {
  it('kết nối xong thì form lấy cấu hình của bản nháp', async () => {
    const draft = fakePrinter(receiptConfig, {
      transportType: TransportType.Usb,
      identity: { vendorId: 1, productId: 2 },
    });
    const { get } = await connectNewAsync(draft);

    expect(get().basePrinter).toBe(draft);
    expect(get().form.getValues()).toMatchObject({
      name: 'Xprinter XP-80',
      lang: PrinterLang.EscPos,
      widthMm: '80',
    });
  });

  it('thêm máy: lưu gọi saveAsync với draft.withConfig(cấu hình form)', async () => {
    const draft = fakePrinter(receiptConfig, {
      transportType: TransportType.Usb,
      identity: { vendorId: 1, productId: 2 },
    });
    const { get, setup } = await connectNewAsync(draft);
    act(() => get().form.setValue('name', 'Quầy 1'));

    await act(async () => get().saveAsync());

    expect(draft.withConfig).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Quầy 1', lang: PrinterLang.EscPos }),
    );
    expect(setup.saveAsync).toHaveBeenCalledWith(
      draft.withConfig.mock.results[0]!.value,
    );
  });

  it('fieldErrors của package gắn vào đúng trường, giá trị đã nhập còn nguyên', async () => {
    const draft = fakePrinter(receiptConfig, {
      transportType: TransportType.Usb,
      identity: { vendorId: 1, productId: 2 },
    });
    draft.withConfig.mockImplementationOnce(() => {
      throw new PrinterError(PrinterErrorCode.InputInvalid, 'sai', {
        fieldErrors: [
          { field: 'paper.widthMm', reason: FieldErrorReason.OutOfRange },
        ],
      });
    });
    const { get, setup } = await connectNewAsync(draft);
    act(() => get().form.setValue('widthMm', '113'));

    await act(async () => get().saveAsync());

    expect(get().form.getFieldState('widthMm').error?.type).toBe(
      FieldErrorReason.OutOfRange,
    );
    expect(get().form.getValues('widthMm')).toBe('113');
    expect(setup.saveAsync).not.toHaveBeenCalled();
  });

  it('in thử máy đang thêm truyền SampleReceipt', async () => {
    const draft = fakePrinter(receiptConfig, {
      transportType: TransportType.Usb,
      identity: { vendorId: 1, productId: 2 },
    });
    const { get } = await connectNewAsync(draft);

    await act(async () => get().testPrintAsync());

    const [printer, renderers] = jest.mocked(printService.testPrintAsync).mock
      .calls[0]!;
    expect(printer).toBe(draft.withConfig.mock.results[0]!.value);
    expect(renderers).toHaveLength(1);
    expect(renderers[0]!({} as never)).toMatchObject({ type: SampleReceipt });
  });

  it('in thử tem truyền SampleLabel đủ số hàng (số hàng × số tem mỗi hàng)', async () => {
    const draft = fakePrinter(labelConfig, {
      transportType: TransportType.Usb,
      identity: { vendorId: 1, productId: 2 },
    });
    const { get } = await connectNewAsync(draft, PrinterKind.Label);
    act(() => get().testPrint.setRowsText('3'));

    await act(async () => get().testPrintAsync());

    const [, renderers] = jest.mocked(printService.testPrintAsync).mock
      .calls[0]!;
    expect(renderers).toHaveLength(6);
    expect(renderers[0]!({} as never)).toMatchObject({ type: SampleLabel });
  });
});

describe('useAddPrinterFlow: sửa máy', () => {
  it('sửa máy: lưu gọi updateAsync với saved.withConfig(cấu hình form)', async () => {
    const saved = fakePrinter(
      receiptConfig,
      {
        transportType: TransportType.Usb,
        identity: { vendorId: 1, productId: 2 },
      },
      'p1',
    );
    const manager = makeManager();
    const onSaved = jest.fn();
    const get = render(
      {
        kind: PrinterKind.Receipt,
        initialPrinter: saved as unknown as Printer,
        dependencies: { manager: manager as unknown as PrinterManager },
      },
      onSaved,
    );
    act(() => get().form.setValue('name', 'Bếp'));

    await act(async () => get().saveAsync());

    expect(saved.withConfig).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Bếp' }),
    );
    expect(manager.updateAsync).toHaveBeenCalledWith(
      saved.withConfig.mock.results[0]!.value,
    );
    expect(manager.updateLanAddressAsync).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalled();
  });

  it('sửa máy LAN đổi IP: gọi updateLanAddressAsync, rồi updateAsync', async () => {
    const saved = fakePrinter(
      receiptConfig,
      { transportType: TransportType.Lan, host: '10.0.0.5', port: 9100 },
      'p1',
    );
    const manager = makeManager();
    const calls: string[] = [];
    manager.updateLanAddressAsync.mockImplementation(async () => {
      calls.push('lan');
    });
    manager.updateAsync.mockImplementation(async () => {
      calls.push('config');
    });
    const get = render({
      kind: PrinterKind.Receipt,
      initialPrinter: saved as unknown as Printer,
      dependencies: { manager: manager as unknown as PrinterManager },
    });
    act(() => get().lan.setHost('10.0.0.8'));

    await act(async () => get().saveAsync());

    expect(manager.updateLanAddressAsync).toHaveBeenCalledWith(
      'p1',
      '10.0.0.8',
      9100,
    );
    expect(calls).toEqual(['lan', 'config']);
  });

  it('in thử máy đã lưu dùng saved.withConfig, không lưu', async () => {
    const saved = fakePrinter(
      receiptConfig,
      {
        transportType: TransportType.Usb,
        identity: { vendorId: 1, productId: 2 },
      },
      'p1',
    );
    const manager = makeManager();
    const get = render({
      kind: PrinterKind.Receipt,
      initialPrinter: saved as unknown as Printer,
      dependencies: { manager: manager as unknown as PrinterManager },
    });
    act(() => get().form.setValue('widthMm', '58'));

    await act(async () => get().testPrintAsync());

    const copy = saved.withConfig.mock.results[0]!.value;
    expect(copy.config.paper.widthMm).toBe(58);
    expect(printService.testPrintAsync).toHaveBeenCalledWith(
      copy,
      expect.any(Array),
    );
    expect(manager.updateAsync).not.toHaveBeenCalled();
  });
});
