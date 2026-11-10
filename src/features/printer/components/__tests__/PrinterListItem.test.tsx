import React from 'react';
import { Text } from 'react-native';
import { PaperProvider, Switch } from 'react-native-paper';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import {
  ConnectionState,
  LangSource,
  PrinterAction,
  PrinterErrorCode,
  PrinterKind,
  PrinterLang,
  type Printer,
  type PrinterStatus,
  type UsbRebindCandidate,
} from '@ndtcore/printer';
import { PrinterListItem } from '../PrinterListItem';
import type { PrinterListActions } from '../../hooks/usePrinterList';
import { printerErrorMessageOf } from '../../errors/PrinterErrorMessages';

/** Máy hoá đơn USB với trạng thái cho trước. */
const printerWith = (status: PrinterStatus): Printer =>
  ({
    id: 'p1',
    createdAt: '2026-11-10T00:00:00.000Z',
    deviceInfo: { manufacturer: 'Xprinter', model: 'XP-80' },
    connectionConfig: { transportType: 'Usb', identity: { vendorId: 1, productId: 2 } },
    config: {
      kind: PrinterKind.Receipt,
      name: 'Quầy',
      lang: PrinterLang.EscPos,
      langSource: LangSource.Probe,
      capabilities: { hasCutter: true, dpi: 203 },
      paper: { widthMm: 80 },
    },
    status,
  }) as unknown as Printer;

const actions = () => ({
  removeAsync: jest.fn((_printerId: string) => Promise.resolve()),
  reconnectAsync: jest.fn((_printerId: string) => Promise.resolve()),
  listUsbDevicesForRebind: jest.fn((_printerId: string): UsbRebindCandidate[] => [
    { device: { path: '/dev/usb/2', vendorId: 1, productId: 2, productName: 'XP-80' } },
    {
      device: { path: '/dev/usb/3', vendorId: 1, productId: 3, productName: 'XP-58' },
      assignedTo: { id: 'p2', name: 'Bếp', kind: PrinterKind.Receipt },
    },
  ]),
  rebindUsbAsync: jest.fn((_printerId: string, _path: string) => Promise.resolve()),
});

/** Renderer của test đang chạy; tháo sau mỗi test để Modal của test trước không cập nhật sang test sau. */
const mounted: ReactTestRenderer[] = [];

afterEach(() => {
  act(() => mounted.splice(0).forEach((renderer) => renderer.unmount()));
});

const render = (status: PrinterStatus, itemActions: PrinterListActions = actions()): ReactTestRenderer => {
  let renderer: ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(
      <PaperProvider>
        <PrinterListItem printer={printerWith(status)} actions={itemActions} onEdit={jest.fn()} />
      </PaperProvider>,
    );
  });
  mounted.push(renderer as ReactTestRenderer);
  return renderer as ReactTestRenderer;
};

const texts = (renderer: ReactTestRenderer): string[] =>
  renderer.root.findAllByType(Text).map((node) => [node.props.children].flat().join(''));

const pressText = (renderer: ReactTestRenderer, label: string): void => {
  const pressable = (item: TestRenderer.ReactTestInstance) => typeof item.props.onPress === 'function';
  const node = renderer.root.findAll((item) => pressable(item) && texts2(item).includes(label));
  act(() => {
    node[0]!.props.onPress();
  });
};

/** Chữ bên trong một node. */
const texts2 = (node: TestRenderer.ReactTestInstance): string[] =>
  node.findAllByType(Text).map((item) => [item.props.children].flat().join(''));

const connected: PrinterStatus = { state: ConnectionState.Connected, actions: [] };

describe('PrinterListItem', () => {
  it('nút Kết nối lại chỉ hiện khi actions có Reconnect', () => {
    expect(texts(render(connected))).not.toContain('Kết nối lại');

    const itemActions = actions();
    const renderer = render(
      {
        state: ConnectionState.Error,
        errorCode: PrinterErrorCode.ConnectionTimeout,
        actions: [PrinterAction.Reconnect],
      },
      itemActions,
    );
    pressText(renderer, 'Kết nối lại');

    expect(itemActions.reconnectAsync).toHaveBeenCalledWith('p1');
  });

  it('nút Chọn lại máy USB chỉ hiện khi actions có RebindUsb, chọn máy gọi rebindUsbAsync', () => {
    expect(texts(render(connected))).not.toContain('Chọn lại máy USB');

    const itemActions = actions();
    const ambiguous: PrinterStatus = {
      state: ConnectionState.Error,
      errorCode: PrinterErrorCode.DeviceAmbiguous,
      actions: [PrinterAction.RebindUsb],
    };
    const renderer = render(ambiguous, itemActions);
    pressText(renderer, 'Chọn lại máy USB');

    expect(texts(renderer).some((text) => text.includes('Đang dùng cho Bếp'))).toBe(true);
    pressText(renderer, 'XP-80 · /dev/usb/2');
    expect(itemActions.rebindUsbAsync).toHaveBeenCalledWith('p1', '/dev/usb/2');
  });

  it('badge: ERROR hiện câu lỗi của errorCode', () => {
    const renderer = render({
      state: ConnectionState.Error,
      errorCode: PrinterErrorCode.PermissionRequired,
      actions: [PrinterAction.Reconnect],
    });

    expect(texts(renderer)).toContain(printerErrorMessageOf(PrinterErrorCode.PermissionRequired));
  });

  it('không còn công tắc bật/tắt', () => {
    expect(render(connected).root.findAllByType(Switch)).toHaveLength(0);
  });
});
