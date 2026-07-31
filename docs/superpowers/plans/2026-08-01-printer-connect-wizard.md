# Printer Connect Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the form-based `AddPrinterModal` with a connect-first wizard that auto-detects a printer's Protocol (ESC/POS vs TSPL) from device info read after connecting, only asking the user to pick a Protocol when auto-detection fails.

**Architecture:** `IPrinterDriver` gains an `identify()` method; a new `discoverProtocol()` orchestration in `PrinterService` tries candidate protocols (ordered by a hardcoded `PRINTER_DETECTION_RULES` table matched against OS-level device hints) via `connect()` + `identify()` until one driver self-confirms, keeping that connection open for the wizard's Test Print step. `PrinterConfig` drops `printerType`, gains `protocolSource`/`deviceInfo`.

**Tech Stack:** Same as Phase 1 — React Native CLI, TypeScript strict, Redux Toolkit, React Hook Form + Zod, React Native Paper, Jest.

**Spec:** `docs/superpowers/specs/2026-08-01-printer-connect-wizard-design.md`

**All file paths in this plan are relative to the `NDTCore.App/` repo root**, unless stated otherwise.

## Global Constraints

- TypeScript strict mode; never use `any`.
- No `console.log` — go through `LoggerService`.
- No component/hook may call a printer SDK/native module directly — everything goes through `PrinterService`.
- Printer connection status is event-driven; no polling anywhere.
- All user-facing text is Vietnamese.
- Forms use React Hook Form + Zod; no manual validation.
- Follow the existing test convention in this codebase: pure logic (schemas, services, drivers, reducers, transports) gets unit tests; wizard/modal UI components do not (no existing test file for the old `AddPrinterModal.tsx`, `DeviceScanList.tsx`, `PrinterListItem.tsx`, etc. — verified manually per spec §7).
- Out of scope, do not touch: ZPL driver, dynamic/MMKV-backed detection rules, hardware-event auto-reconnect, built-in printers (Sunmi/iMin), `PrinterListItem`'s existing menu actions (Kết nối/Ngắt/Kết nối lại/Đặt mặc định/Xóa — unchanged, they already use `protocol` from storage).

---

## Key Architecture Decision Not Covered By The Spec (flag to human reviewer)

The spec's `discoverProtocol()` assumes the wizard can scan devices before knowing the protocol, but the **existing** `DeviceScanList` component requires a `protocol` prop (`PrinterService.scanDevices(protocol, connectionType, onEvent)`) because `scan()` lives on `IPrinterDriver`, one per protocol. Reading the real driver code:

- `TsplDriver.scan('bluetooth')` calls `RNBluetoothClassic.startDiscovery()` directly — a **protocol-agnostic** listing of every discoverable Bluetooth device.
- `TsplDriver.scan('usb')` immediately errors (`UNSUPPORTED_CONNECTION`) — TSPL never supports USB (Phase 1 §4.3, unchanged).
- `EscPosDriver.scan(*)` uses the Epson SDK's own `PrintersDiscovery`, which is Epson/ESC-POS-specific.

Resolution used in this plan (Task 9): add `PrinterService.scanForConnectionType(connectionType, onEvent)` that scans via **`TsplDriver` for Bluetooth** (broadest, protocol-agnostic device list) and **`EscPosDriver` for USB** (the only driver that supports USB scanning at all). Both drivers build `PrinterDevice.deviceId` from the same underlying OS identifier (Bluetooth MAC address / USB target), so a device found this way can still be `connect()`-ed by whichever driver `discoverProtocol()` tries. `DeviceScanList` loses its `protocol` prop as a result (Task 10).

---

### Task 1: Data Model — `PrinterConfig`, `PrinterDeviceInfo`, `ProtocolSource`

**Files:**
- Modify: `src/features/printer/types/printer.types.ts`
- Modify: `src/features/printer/types/printer.types.test.ts`

**Interfaces:**
- Consumes: nothing beyond what Phase 1 already defines
- Produces: `PrinterDeviceInfo`, `ProtocolSource`, updated `PrinterConfig` (no `printerType`, has `protocolSource`/`deviceInfo`) — every later task imports these exact names.

- [ ] **Step 1: Update the failing test fixture first**

Edit `src/features/printer/types/printer.types.test.ts` — remove `printerType: 'label',` from the fixture and add `protocolSource`:

```ts
import type { IPrinterDriver } from './driver.types';
import type { PrinterConfig } from './printer.types';

describe('printer domain types', () => {
  it('accepts a fully-formed PrinterConfig for a LAN TSPL label printer', () => {
    const config: PrinterConfig = {
      id: 'p1',
      printerName: 'Máy in tem quầy 1',
      protocol: 'tspl',
      protocolSource: 'auto',
      connectionType: 'lan',
      paperSize: '58mm',
      autoReconnect: true,
      isDefault: false,
      lan: { ip: '192.168.1.50', port: 9100 },
    };
    expect(config.protocol).toBe('tspl');
  });

  it('a mock driver satisfies IPrinterDriver', () => {
    const driver: IPrinterDriver = {
      scan: () => () => undefined,
      connect: async () => undefined,
      disconnect: async () => undefined,
      getStatus: () => 'idle',
      onStatusChange: () => () => undefined,
      testPrint: async () => undefined,
      identify: async () => null,
    };
    expect(driver.getStatus('p1')).toBe('idle');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx jest src/features/printer/types/printer.types.test.ts
```

Expected: FAIL — `printerType` doesn't exist yet is fine (that's the old type), but `protocolSource` and `identify` don't exist on the current types → TS compile error inside the test.

- [ ] **Step 3: Update `printer.types.ts`**

```ts
import type { AppError } from '../../../types/AppError';

export type Protocol = 'escpos' | 'tspl';
export type ConnectionType = 'usb' | 'bluetooth' | 'lan';
export type PaperSize = '58mm' | '80mm';
export type ProtocolSource = 'auto' | 'manual';

export type PrinterStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'disconnected'
  | 'reconnecting'
  | 'error';

export interface PrinterDevice {
  deviceId: string;
  displayName: string;
  rawDevice: Record<string, unknown>;
}

export interface PrinterLanConfig {
  ip: string;
  port: number;
}

export interface PrinterDeviceInfo {
  deviceName?: string;
  vendor?: string;
  model?: string;
}

export interface PrinterConfig {
  id: string;
  printerName: string;
  protocol: Protocol;
  protocolSource: ProtocolSource;
  connectionType: ConnectionType;
  paperSize: PaperSize;
  autoReconnect: boolean;
  isDefault: boolean;
  device?: PrinterDevice;
  lan?: PrinterLanConfig;
  deviceInfo?: PrinterDeviceInfo;
}

export type DeviceScanEventType = 'loading' | 'found' | 'empty' | 'error';

export interface DeviceScanEvent {
  type: DeviceScanEventType;
  devices?: PrinterDevice[];
  error?: AppError;
}
```

`PrinterType` is fully removed — nothing else in the codebase defines it (verified: only `printer.types.ts` itself declared it).

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx jest src/features/printer/types/printer.types.test.ts
```

Expected: still FAILS — `identify` isn't on `IPrinterDriver` yet (Task 2). This is expected; proceed to Task 2 before re-running.

- [ ] **Step 5: Commit**

```bash
git add src/features/printer/types/printer.types.ts src/features/printer/types/printer.types.test.ts
git commit -m "feat: drop printerType, add protocolSource and deviceInfo to PrinterConfig"
```

---

### Task 2: Driver Contract — `identify()`

**Files:**
- Modify: `src/features/printer/types/driver.types.ts`

**Interfaces:**
- Consumes: `PrinterDeviceInfo` (Task 1)
- Produces: `IPrinterDriver.identify(printerId: string): Promise<PrinterDeviceInfo | null>` — implemented by `TsplDriver` (Task 6) and `EscPosDriver` (Task 7), called by `discoverProtocol` (Task 8).

- [ ] **Step 1: Update `driver.types.ts`**

```ts
import type { ConnectionType, DeviceScanEvent, PrinterConfig, PrinterDeviceInfo, PrinterStatus } from './printer.types';

export type Unsubscribe = () => void;

export interface IPrinterDriver {
  scan(connectionType: ConnectionType, onEvent: (event: DeviceScanEvent) => void): Unsubscribe;
  connect(config: PrinterConfig): Promise<void>;
  disconnect(printerId: string): Promise<void>;
  getStatus(printerId: string): PrinterStatus;
  onStatusChange(printerId: string, callback: (status: PrinterStatus) => void): Unsubscribe;
  testPrint(config: PrinterConfig): Promise<void>;
  identify(printerId: string): Promise<PrinterDeviceInfo | null>;
}
```

- [ ] **Step 2: Run the full type-check to see everywhere this breaks**

```bash
npx tsc --noEmit
```

Expected: errors in `printer.types.test.ts` (should now pass — re-check), `TsplDriver.ts`, `EscPosDriver.ts` (missing `identify`), `TsplDriver.test.ts`, `EscPosDriver.test.ts`, `PrinterService.test.ts`, `printerSlice.test.ts`, `printerFormSchema.ts` (all still reference removed `printerType` or missing `identify`). These are fixed in Tasks 3–11 — this step is just a checkpoint, not a gate.

- [ ] **Step 3: Commit**

```bash
git add src/features/printer/types/driver.types.ts
git commit -m "feat: add identify() to IPrinterDriver contract"
```

---

### Task 3: Printer Detection Rules

**Files:**
- Create: `src/features/printer/constants/printerDetectionRules.ts`
- Test: `src/features/printer/constants/printerDetectionRules.test.ts`

**Interfaces:**
- Consumes: `Protocol` (Task 1)
- Produces: `PrinterDetectionRule`, `PRINTER_DETECTION_RULES` — consumed by `discoverProtocol` (Task 8).

- [ ] **Step 1: Write the failing tests**

```ts
// src/features/printer/constants/printerDetectionRules.test.ts
import { PRINTER_DETECTION_RULES } from './printerDetectionRules';

describe('PRINTER_DETECTION_RULES', () => {
  it('ends with a catch-all fallback rule with low confidence', () => {
    const last = PRINTER_DETECTION_RULES[PRINTER_DETECTION_RULES.length - 1];
    expect(last.vendorMatch.test('anything at all')).toBe(true);
    expect(last.confidence).toBe('low');
    expect(last.candidates).toEqual(['escpos', 'tspl']);
  });

  it('matches Epson TM-T82III to escpos with high confidence', () => {
    const rule = PRINTER_DETECTION_RULES.find(
      (r) => r.vendorMatch.test('Epson TM-T82III') && (!r.modelMatch || r.modelMatch.test('Epson TM-T82III')),
    );
    expect(rule?.candidates).toEqual(['escpos']);
    expect(rule?.confidence).toBe('high');
  });

  it('matches Xprinter XP-365B to a dual candidate list with low confidence', () => {
    const rule = PRINTER_DETECTION_RULES.find(
      (r) => r.vendorMatch.test('Xprinter XP-365B') && (!r.modelMatch || r.modelMatch.test('Xprinter XP-365B')),
    );
    expect(rule?.candidates).toEqual(['tspl', 'escpos']);
    expect(rule?.confidence).toBe('low');
  });

  it('matches Xprinter XP-58 (receipt) to escpos, not the label rules', () => {
    const rule = PRINTER_DETECTION_RULES.find(
      (r) => r.vendorMatch.test('Xprinter XP-58') && (!r.modelMatch || r.modelMatch.test('Xprinter XP-58')),
    );
    expect(rule?.candidates).toEqual(['escpos']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/features/printer/constants/printerDetectionRules.test.ts
```

Expected: FAIL — `Cannot find module './printerDetectionRules'`.

- [ ] **Step 3: Write `printerDetectionRules.ts`**

```ts
// src/features/printer/constants/printerDetectionRules.ts
import type { Protocol } from '../types/printer.types';

/**
 * Luật nhận diện thiết bị: cho ra danh sách candidate driver theo thứ tự ưu
 * tiên để `discoverProtocol()` thử — KHÔNG phải kết luận protocol cuối cùng.
 * Xác nhận thật luôn phải qua `IPrinterDriver.identify()` của driver tương ứng.
 */
export interface PrinterDetectionRule {
  vendorMatch: RegExp;
  modelMatch?: RegExp;
  candidates: Protocol[];
  confidence: 'high' | 'medium' | 'low';
  note?: string;
}

export const PRINTER_DETECTION_RULES: PrinterDetectionRule[] = [
  // ===== ESC/POS — Receipt Printer (độ ưu tiên rất cao, ~90% cửa hàng) =====
  {
    vendorMatch: /epson/i,
    modelMatch: /TM-?(T82III|T82|T20|M30)/i,
    candidates: ['escpos'],
    confidence: 'high',
    note: 'Epson TM series — chuẩn ESC/POS gốc',
  },
  {
    vendorMatch: /xprinter/i,
    modelMatch: /XP-?(58|80|Q200|Q260)/i,
    candidates: ['escpos'],
    confidence: 'high',
    note: 'Dòng receipt Xprinter — KHÁC dòng label bên dưới, bắt buộc match model để phân biệt',
  },
  {
    vendorMatch: /goojprt/i,
    modelMatch: /GP-?(58|80)/i,
    candidates: ['escpos'],
    confidence: 'high',
  },
  {
    vendorMatch: /zjiang/i,
    modelMatch: /ZJ-?(58|80|5890)/i,
    candidates: ['escpos'],
    confidence: 'high',
  },
  {
    vendorMatch: /rongta/i,
    modelMatch: /RP(80|58)/i,
    candidates: ['escpos'],
    confidence: 'high',
  },

  // ===== TSPL — Label Printer (độ ưu tiên cao) =====
  {
    vendorMatch: /xprinter/i,
    modelMatch: /XP-?(360B|370B|420B|450B)/i,
    candidates: ['tspl'],
    confidence: 'high',
    note: 'Dòng label Xprinter — KHÔNG gồm 365B (xem rule dual bên dưới)',
  },
  {
    vendorMatch: /gprinter/i,
    modelMatch: /GP-?(1424D|2120TU|3120TU)/i,
    candidates: ['tspl'],
    confidence: 'high',
  },
  {
    vendorMatch: /hprt/i,
    modelMatch: /(HT300|HT330|N31|N41)/i,
    candidates: ['tspl'],
    confidence: 'medium',
    note: 'Chưa verify riêng từng model HPRT với deviceInfo thật, tạm confidence=medium',
  },
  {
    vendorMatch: /tsc/i,
    modelMatch: /(TE200|TE210|TTP-?244|DA210)/i,
    candidates: ['tspl'],
    confidence: 'high',
    note: 'TSC TTP-244 xác nhận dùng TSPL-EZ (đã verify). TE/DA series theo thông lệ hãng cũng TSPL',
  },

  // ===== DUAL-MODE — match được vendor/model nhưng KHÔNG được suy đoán 1 protocol =====
  {
    vendorMatch: /xprinter/i,
    modelMatch: /365B/i,
    candidates: ['tspl', 'escpos'],
    confidence: 'low',
    note:
      'XP-365B hỗ trợ CẢ TSPL và ESC/POS emulation, có cả print mode Label lẫn Receipt trên cùng máy. ' +
      'confidence=low bắt buộc để discoverProtocol() KHÔNG tự chọn — phải rơi vào unknown_protocol ' +
      'và hỏi người dùng xác nhận Printer Language dù đã match được vendor/model.',
  },

  // ===== KHÔNG đưa Sunmi/iMin vào bảng regex vendor/model này =====
  // Đây là POS tích hợp sẵn máy in (built-in), truy cập qua SDK/AIDL riêng của
  // hãng (SunmiPrinterService, iMin SDK...), KHÔNG kết nối qua USB/Bluetooth/LAN
  // nên không bao giờ đi qua discoverProtocol() dựa trên bảng regex này.
  // Ngoài phạm vi implementation này — xem spec mục 2 và mục 8.

  // TODO: bổ sung thêm rule khi có deviceInfo thật từ thiết bị test (đặc biệt cần
  // xác nhận format vendor/model string mà identify() thực sự trả về).

  // Luật fallback bắt-tất-cả — LUÔN đặt cuối danh sách.
  { vendorMatch: /.*/, candidates: ['escpos', 'tspl'], confidence: 'low' },
];
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest src/features/printer/constants/printerDetectionRules.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/printer/constants/printerDetectionRules.ts src/features/printer/constants/printerDetectionRules.test.ts
git commit -m "feat: add printer detection rules for protocol candidate ordering"
```

---

### Task 4: `LanTransport.readOnce()`

**Files:**
- Modify: `src/features/printer/transports/LanTransport.ts`
- Test: `src/features/printer/transports/LanTransport.test.ts`

**Interfaces:**
- Consumes: nothing new
- Produces: `LanTransport.readOnce(timeoutMs: number): Promise<Uint8Array | null>` — consumed by `TsplDriver.identify()` (Task 6).

- [ ] **Step 1: Write the failing tests**

```ts
// src/features/printer/transports/LanTransport.test.ts
import { LanTransport } from './LanTransport';

type DataListener = (data: Buffer | string) => void;

jest.mock('react-native-tcp-socket', () => {
  const listeners: Record<string, DataListener[]> = { data: [], error: [] };
  const mockSocket = {
    on: jest.fn((event: string, listener: DataListener) => {
      listeners[event] = listeners[event] ?? [];
      listeners[event].push(listener);
    }),
    removeListener: jest.fn((event: string, listener: DataListener) => {
      listeners[event] = (listeners[event] ?? []).filter((l) => l !== listener);
    }),
    write: jest.fn(),
    destroy: jest.fn(),
  };
  return {
    __esModule: true,
    default: {
      createConnection: jest.fn((_opts: unknown, onConnect: () => void) => {
        onConnect();
        return mockSocket;
      }),
    },
    __mockSocket: mockSocket,
    __emit: (event: string, ...args: unknown[]) => {
      (listeners[event] ?? []).forEach((listener) => (listener as (...a: unknown[]) => void)(...args));
    },
  };
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const tcpSocketMock = jest.requireMock('react-native-tcp-socket') as {
  __emit: (event: string, ...args: unknown[]) => void;
};

describe('LanTransport.readOnce', () => {
  it('resolves with the received bytes when data arrives before the timeout', async () => {
    const transport = new LanTransport();
    await transport.connect('192.168.1.60', 9100);
    const resultPromise = transport.readOnce(1000);
    tcpSocketMock.__emit('data', Buffer.from([0x01, 0x02, 0x03]));
    const result = await resultPromise;
    expect(result).toEqual(new Uint8Array([0x01, 0x02, 0x03]));
  });

  it('resolves with null when the timeout elapses with no data', async () => {
    jest.useFakeTimers();
    const transport = new LanTransport();
    await transport.connect('192.168.1.60', 9100);
    const resultPromise = transport.readOnce(500);
    jest.advanceTimersByTime(500);
    const result = await resultPromise;
    expect(result).toBeNull();
    jest.useRealTimers();
  });

  it('resolves with null immediately when not connected', async () => {
    const transport = new LanTransport();
    const result = await transport.readOnce(500);
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/features/printer/transports/LanTransport.test.ts
```

Expected: FAIL — `transport.readOnce is not a function`.

- [ ] **Step 3: Add `readOnce()` to `LanTransport.ts`**

```ts
// src/features/printer/transports/LanTransport.ts
import TcpSocket from 'react-native-tcp-socket';
import { AppErrorException } from '../../../types/AppError';

type LanSocket = ReturnType<typeof TcpSocket.createConnection>;

export class LanTransport {
  private socket: LanSocket | null = null;

  connect(ip: string, port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = TcpSocket.createConnection({ host: ip, port }, () => resolve());
      socket.on('error', (error: Error) => reject(error));
      this.socket = socket;
    });
  }

  write(bytes: Uint8Array): void {
    if (!this.socket) {
      throw new AppErrorException({ code: 'CONNECTION_ERROR', message: 'LAN socket chưa được kết nối' });
    }
    this.socket.write(bytes);
  }

  /**
   * Đọc 1 lần dữ liệu phản hồi từ socket trong `timeoutMs`, dùng cho
   * `TsplDriver.identify()` — không dùng cho luồng in bình thường (chỉ ghi).
   */
  readOnce(timeoutMs: number): Promise<Uint8Array | null> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve(null);
        return;
      }
      const socket = this.socket;
      const onData = (data: Buffer | string): void => {
        clearTimeout(timer);
        socket.removeListener('data', onData);
        const buffer = typeof data === 'string' ? Buffer.from(data) : data;
        resolve(new Uint8Array(buffer));
      };
      const timer = setTimeout(() => {
        socket.removeListener('data', onData);
        resolve(null);
      }, timeoutMs);
      socket.on('data', onData);
    });
  }

  close(): void {
    this.socket?.destroy();
    this.socket = null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest src/features/printer/transports/LanTransport.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/printer/transports/LanTransport.ts src/features/printer/transports/LanTransport.test.ts
git commit -m "feat: add LanTransport.readOnce for protocol identification"
```

---

### Task 5: `BluetoothTransport.readOnce()`

**Files:**
- Modify: `src/features/printer/transports/BluetoothTransport.ts`
- Test: `src/features/printer/transports/BluetoothTransport.test.ts`

**Interfaces:**
- Consumes: nothing new
- Produces: `BluetoothTransport.readOnce(timeoutMs: number): Promise<Uint8Array | null>` — consumed by `TsplDriver.identify()` (Task 6).

- [ ] **Step 1: Write the failing tests**

```ts
// src/features/printer/transports/BluetoothTransport.test.ts
import { BluetoothTransport } from './BluetoothTransport';

type ReceivedListener = (event: { data: string }) => void;

jest.mock('react-native-bluetooth-classic', () => {
  let dataListener: ReceivedListener | null = null;
  const mockDevice = {
    write: jest.fn().mockResolvedValue(true),
    disconnect: jest.fn().mockResolvedValue(true),
    onDataReceived: jest.fn((listener: ReceivedListener) => {
      dataListener = listener;
      return { remove: jest.fn(() => { dataListener = null; }) };
    }),
  };
  return {
    __esModule: true,
    default: {
      connectToDevice: jest.fn().mockResolvedValue(mockDevice),
    },
    __emitData: (base64: string) => dataListener?.({ data: base64 }),
  };
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const bluetoothMock = jest.requireMock('react-native-bluetooth-classic') as {
  __emitData: (base64: string) => void;
};

describe('BluetoothTransport.readOnce', () => {
  it('resolves with the decoded bytes when data arrives before the timeout', async () => {
    const transport = new BluetoothTransport();
    await transport.connect('AA:BB:CC:DD:EE:FF');
    const resultPromise = transport.readOnce(1000);
    bluetoothMock.__emitData(Buffer.from([0x41, 0x42]).toString('base64'));
    const result = await resultPromise;
    expect(result).toEqual(new Uint8Array([0x41, 0x42]));
  });

  it('resolves with null when the timeout elapses with no data', async () => {
    jest.useFakeTimers();
    const transport = new BluetoothTransport();
    await transport.connect('AA:BB:CC:DD:EE:FF');
    const resultPromise = transport.readOnce(500);
    jest.advanceTimersByTime(500);
    const result = await resultPromise;
    expect(result).toBeNull();
    jest.useRealTimers();
  });

  it('resolves with null immediately when not connected', async () => {
    const transport = new BluetoothTransport();
    const result = await transport.readOnce(500);
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/features/printer/transports/BluetoothTransport.test.ts
```

Expected: FAIL — `transport.readOnce is not a function`.

- [ ] **Step 3: Add `readOnce()` to `BluetoothTransport.ts`**

```ts
// src/features/printer/transports/BluetoothTransport.ts
import RNBluetoothClassic, { type BluetoothDevice } from 'react-native-bluetooth-classic';
import { Buffer } from 'buffer';
import { AppErrorException } from '../../../types/AppError';

export class BluetoothTransport {
  private device: BluetoothDevice | null = null;

  async connect(deviceId: string): Promise<void> {
    this.device = await RNBluetoothClassic.connectToDevice(deviceId);
  }

  async write(bytes: Uint8Array): Promise<void> {
    if (!this.device) {
      throw new AppErrorException({ code: 'CONNECTION_ERROR', message: 'Thiết bị Bluetooth chưa được kết nối' });
    }
    await this.device.write(Buffer.from(bytes).toString('base64'), 'base64');
  }

  /**
   * Đọc 1 lần dữ liệu phản hồi từ thiết bị trong `timeoutMs`, dùng cho
   * `TsplDriver.identify()` — không dùng cho luồng in bình thường (chỉ ghi).
   */
  readOnce(timeoutMs: number): Promise<Uint8Array | null> {
    return new Promise((resolve) => {
      if (!this.device) {
        resolve(null);
        return;
      }
      const subscription = this.device.onDataReceived((event) => {
        clearTimeout(timer);
        subscription.remove();
        resolve(new Uint8Array(Buffer.from(event.data, 'base64')));
      });
      const timer = setTimeout(() => {
        subscription.remove();
        resolve(null);
      }, timeoutMs);
    });
  }

  async close(): Promise<void> {
    await this.device?.disconnect();
    this.device = null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest src/features/printer/transports/BluetoothTransport.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/printer/transports/BluetoothTransport.ts src/features/printer/transports/BluetoothTransport.test.ts
git commit -m "feat: add BluetoothTransport.readOnce for protocol identification"
```

---

### Task 6: `TsplDriver.identify()`

**Files:**
- Modify: `src/features/printer/drivers/TsplDriver.ts`
- Modify: `src/features/printer/drivers/TsplDriver.test.ts`

**Interfaces:**
- Consumes: `LanTransport.readOnce`/`BluetoothTransport.readOnce` (Tasks 4–5), `PrinterDeviceInfo` (Task 1)
- Produces: `TsplDriver.identify(printerId): Promise<PrinterDeviceInfo | null>` — consumed by `discoverProtocol` (Task 8).

- [ ] **Step 1: Update the test fixtures and add identify tests**

Replace the top of `TsplDriver.test.ts` (remove `printerType`, add `protocolSource`, mock `readOnce`):

```ts
// src/features/printer/drivers/TsplDriver.test.ts
import { TsplDriver } from './TsplDriver';
import type { PrinterConfig } from '../types/printer.types';

jest.mock('../transports/LanTransport', () => ({
  LanTransport: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    write: jest.fn(),
    readOnce: jest.fn().mockResolvedValue(null),
    close: jest.fn(),
  })),
}));

jest.mock('../transports/BluetoothTransport', () => ({
  BluetoothTransport: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    write: jest.fn().mockResolvedValue(undefined),
    readOnce: jest.fn().mockResolvedValue(null),
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

const lanConfig: PrinterConfig = {
  id: 'label-1',
  printerName: 'Máy in tem',
  protocol: 'tspl',
  protocolSource: 'auto',
  connectionType: 'lan',
  paperSize: '58mm',
  autoReconnect: false,
  isDefault: false,
  lan: { ip: '192.168.1.60', port: 9100 },
};

const usbConfig: PrinterConfig = { ...lanConfig, id: 'label-usb', connectionType: 'usb', device: undefined };
```

Keep all existing `describe('TsplDriver', ...)` tests (`connect()`, `disconnect()`, USB rejection, `scan()`) unchanged content-wise — they still pass with the updated fixtures. Add these new tests inside the same `describe` block:

```ts
  it('identify() returns null when not connected', async () => {
    const driver = new TsplDriver();
    const result = await driver.identify('never-connected');
    expect(result).toBeNull();
  });

  it('identify() returns null when the transport does not respond in time', async () => {
    const driver = new TsplDriver();
    await driver.connect(lanConfig);
    const result = await driver.identify(lanConfig.id);
    expect(result).toBeNull();
  });

  it('identify() returns a non-null PrinterDeviceInfo when the transport responds', async () => {
    const { LanTransport } = jest.requireMock('../transports/LanTransport') as {
      LanTransport: jest.Mock;
    };
    LanTransport.mockImplementation(() => ({
      connect: jest.fn().mockResolvedValue(undefined),
      write: jest.fn(),
      readOnce: jest.fn().mockResolvedValue(new Uint8Array([0x01])),
      close: jest.fn(),
    }));
    const driver = new TsplDriver();
    await driver.connect(lanConfig);
    const result = await driver.identify(lanConfig.id);
    expect(result).not.toBeNull();
  });
```

- [ ] **Step 2: Run test to verify the new tests fail**

```bash
npx jest src/features/printer/drivers/TsplDriver.test.ts
```

Expected: FAIL on the 3 new tests — `driver.identify is not a function`.

- [ ] **Step 3: Add `identify()` to `TsplDriver.ts`**

```ts
// src/features/printer/drivers/TsplDriver.ts
import RNBluetoothClassic from 'react-native-bluetooth-classic';
import type { IPrinterDriver, Unsubscribe } from '../types/driver.types';
import type { ConnectionType, DeviceScanEvent, PrinterConfig, PrinterDeviceInfo, PrinterStatus } from '../types/printer.types';
import { TsplEncoder } from '../protocols/TsplEncoder';
import { LanTransport } from '../transports/LanTransport';
import { BluetoothTransport } from '../transports/BluetoothTransport';
import { UsbTransport } from '../transports/UsbTransport';
import { AppErrorException } from '../../../types/AppError';

type TsplTransport = LanTransport | BluetoothTransport | UsbTransport;

const IDENTIFY_TIMEOUT_MS = 1000;

/**
 * Mã hoá 1 lệnh TSPL ASCII đơn giản thành byte thô — dùng riêng cho lệnh dò
 * trạng thái trong `identify()`, không qua `TsplEncoder` (vốn dành cho nội
 * dung in thật, không có API gửi lệnh raw).
 */
const encodeAsciiCommand = (text: string): Uint8Array => {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) {
    // eslint-disable-next-line no-bitwise -- intentional single-byte masking, same as TsplEncoder.encode()
    bytes[i] = text.charCodeAt(i) & 0xff;
  }
  return bytes;
};

export class TsplDriver implements IPrinterDriver {
  private connections = new Map<string, TsplTransport>();
  private statuses = new Map<string, PrinterStatus>();
  private listeners = new Map<string, Set<(status: PrinterStatus) => void>>();

  private setStatus(printerId: string, status: PrinterStatus): void {
    this.statuses.set(printerId, status);
    this.listeners.get(printerId)?.forEach((callback) => callback(status));
  }

  private createTransport(connectionType: ConnectionType): TsplTransport {
    if (connectionType === 'lan') return new LanTransport();
    if (connectionType === 'bluetooth') return new BluetoothTransport();
    return new UsbTransport();
  }

  scan(connectionType: ConnectionType, onEvent: (event: DeviceScanEvent) => void): Unsubscribe {
    if (connectionType === 'lan') {
      onEvent({ type: 'empty' });
      return () => undefined;
    }
    if (connectionType === 'usb') {
      onEvent({
        type: 'error',
        error: { code: 'UNSUPPORTED_CONNECTION', message: 'USB chưa được hỗ trợ cho máy in tem' },
      });
      return () => undefined;
    }
    onEvent({ type: 'loading' });
    RNBluetoothClassic.startDiscovery()
      .then((devices) => {
        onEvent({
          type: devices.length > 0 ? 'found' : 'empty',
          devices: devices.map((d) => ({
            deviceId: d.address,
            displayName: d.name ?? d.address,
            rawDevice: d as unknown as Record<string, unknown>,
          })),
        });
      })
      .catch((error: unknown) => {
        onEvent({ type: 'error', error: { code: 'CONNECTION_ERROR', message: String(error) } });
      });
    return () => {
      RNBluetoothClassic.cancelDiscovery().catch(() => undefined);
    };
  }

  async connect(config: PrinterConfig): Promise<void> {
    this.setStatus(config.id, 'connecting');
    try {
      const transport = this.createTransport(config.connectionType);
      if (config.connectionType === 'lan') {
        if (!config.lan) throw new AppErrorException({ code: 'VALIDATION_ERROR', message: 'Thiếu cấu hình IP/Port' });
        await (transport as LanTransport).connect(config.lan.ip, config.lan.port);
      } else if (config.connectionType === 'bluetooth') {
        if (!config.device) {
          throw new AppErrorException({ code: 'VALIDATION_ERROR', message: 'Chưa chọn thiết bị Bluetooth' });
        }
        await (transport as BluetoothTransport).connect(config.device.deviceId);
      } else {
        await (transport as UsbTransport).connect();
      }
      this.connections.set(config.id, transport);
      this.setStatus(config.id, 'connected');
    } catch (error) {
      this.setStatus(config.id, 'error');
      throw error;
    }
  }

  async disconnect(printerId: string): Promise<void> {
    this.setStatus(printerId, 'disconnecting');
    const transport = this.connections.get(printerId);
    await transport?.close();
    this.connections.delete(printerId);
    this.setStatus(printerId, 'disconnected');
  }

  getStatus(printerId: string): PrinterStatus {
    return this.statuses.get(printerId) ?? 'idle';
  }

  onStatusChange(printerId: string, callback: (status: PrinterStatus) => void): Unsubscribe {
    if (!this.listeners.has(printerId)) this.listeners.set(printerId, new Set());
    this.listeners.get(printerId)?.add(callback);
    return () => this.listeners.get(printerId)?.delete(callback);
  }

  async testPrint(config: PrinterConfig): Promise<void> {
    await this.connect(config);
    const transport = this.connections.get(config.id);
    const bytes = new TsplEncoder()
      .initialize(config.paperSize)
      .text(10, 10, 'NDTCore POS - In thu')
      .cut()
      .encode();
    if (config.connectionType === 'lan') {
      (transport as LanTransport).write(bytes);
    } else if (config.connectionType === 'bluetooth') {
      await (transport as BluetoothTransport).write(bytes);
    }
  }

  /**
   * Gửi lệnh trạng thái TSPL ("~!T") và chờ phản hồi trong `IDENTIFY_TIMEOUT_MS`.
   * Nhiều máy in tem giá rẻ không phản hồi lệnh này — trả `null` là kết quả
   * hợp lệ, không phải lỗi (spec §4.1, §8).
   *
   * Dùng `'readOnce' in transport` để thu hẹp kiểu thay vì `instanceof`:
   * `identify()` chỉ nhận `printerId` (không có `config.connectionType` như
   * `connect()`/`testPrint()`), và `instanceof` không đáng tin cậy với các
   * lớp bị jest mock qua `mockImplementation(() => ({...}))` (object literal
   * trả về không có `LanTransport.prototype` trong chuỗi prototype). USB
   * không có `readOnce` (chỉ Lan/Bluetooth có, thêm ở Task 4–5) nên bị loại
   * ngay mà không cần gọi `write()` (vốn luôn throw trên USB).
   */
  async identify(printerId: string): Promise<PrinterDeviceInfo | null> {
    const transport = this.connections.get(printerId);
    if (!transport || !('readOnce' in transport)) return null;
    try {
      const query = encodeAsciiCommand('~!T\r\n');
      await transport.write(query);
      const response = await transport.readOnce(IDENTIFY_TIMEOUT_MS);
      return response && response.length > 0 ? {} : null;
    } catch {
      return null;
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest src/features/printer/drivers/TsplDriver.test.ts
```

Expected: PASS (8 tests — 5 existing + 3 new).

- [ ] **Step 5: Commit**

```bash
git add src/features/printer/drivers/TsplDriver.ts src/features/printer/drivers/TsplDriver.test.ts
git commit -m "feat: add TsplDriver.identify()"
```

---

### Task 7: `EscPosDriver.identify()`

**Files:**
- Modify: `src/features/printer/drivers/EscPosDriver.ts`
- Modify: `src/features/printer/drivers/EscPosDriver.test.ts`

**Interfaces:**
- Consumes: `Printer.getStatus()` from `react-native-esc-pos-printer` (already imported), `PrinterDeviceInfo` (Task 1)
- Produces: `EscPosDriver.identify(printerId): Promise<PrinterDeviceInfo | null>` — consumed by `discoverProtocol` (Task 8).

- [ ] **Step 1: Update the test fixture and add identify tests**

Edit `EscPosDriver.test.ts`: change `printerType: 'receipt',` → `protocolSource: 'auto',` in `receiptConfig`, and add `getStatus` to the mocked printer instance plus two new tests inside the existing `describe('EscPosDriver', ...)` block:

```ts
// top of jest.mock('react-native-esc-pos-printer', ...) — add getStatus to printerInstance:
  const printerInstance = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    addText: jest.fn().mockResolvedValue(undefined),
    addFeedLine: jest.fn().mockResolvedValue(undefined),
    addCut: jest.fn().mockResolvedValue(undefined),
    sendData: jest.fn().mockResolvedValue({}),
    getStatus: jest.fn().mockResolvedValue({}),
  };
```

```ts
const receiptConfig: PrinterConfig = {
  id: 'receipt-1',
  printerName: 'Máy in hóa đơn quầy 1',
  protocol: 'escpos',
  protocolSource: 'auto',
  connectionType: 'lan',
  paperSize: '80mm',
  autoReconnect: true,
  isDefault: true,
  lan: { ip: '192.168.1.10', port: 9100 },
};
```

New tests (add inside the `describe` block):

```ts
  it('identify() returns null when not connected', async () => {
    const driver = new EscPosDriver();
    const result = await driver.identify('never-connected');
    expect(result).toBeNull();
  });

  it('identify() returns the printer deviceName when getStatus() resolves', async () => {
    const driver = new EscPosDriver();
    await driver.connect(receiptConfig);
    const result = await driver.identify(receiptConfig.id);
    expect(result).toEqual({ deviceName: receiptConfig.printerName });
  });

  it('identify() returns null when getStatus() rejects', async () => {
    const { Printer } = jest.requireMock('react-native-esc-pos-printer') as { Printer: jest.Mock };
    Printer.mockImplementationOnce(() => ({
      connect: jest.fn().mockResolvedValue(undefined),
      getStatus: jest.fn().mockRejectedValue(new Error('no response')),
    }));
    const driver = new EscPosDriver();
    await driver.connect(receiptConfig);
    const result = await driver.identify(receiptConfig.id);
    expect(result).toBeNull();
  });
```

- [ ] **Step 2: Run test to verify the new tests fail**

```bash
npx jest src/features/printer/drivers/EscPosDriver.test.ts
```

Expected: FAIL on the 3 new tests — `driver.identify is not a function`.

- [ ] **Step 3: Add `identify()` to `EscPosDriver.ts`**

Add this method to the `EscPosDriver` class, right after `getStatus()`:

```ts
  /**
   * Gọi `printer.getStatus()` — nếu SDK trả về (không throw), máy in đã phản
   * hồi đúng lệnh ESC/POS status, coi là xác nhận protocol. SDK không có API
   * đọc vendor/model (chỉ có paper/density/speed settings), nên chỉ trả về
   * `deviceName` — xem spec §8 (rủi ro đã ghi nhận).
   */
  async identify(printerId: string): Promise<PrinterDeviceInfo | null> {
    const printer = this.printers.get(printerId);
    if (!printer) return null;
    try {
      await printer.getStatus();
      return { deviceName: printer.deviceName };
    } catch {
      return null;
    }
  }
```

Add `PrinterDeviceInfo` to the existing type-only import at the top of the file:

```ts
import type { ConnectionType, DeviceScanEvent, PrinterConfig, PrinterDeviceInfo, PrinterStatus } from '../types/printer.types';
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest src/features/printer/drivers/EscPosDriver.test.ts
```

Expected: PASS (7 tests — 4 existing + 3 new).

- [ ] **Step 5: Commit**

```bash
git add src/features/printer/drivers/EscPosDriver.ts src/features/printer/drivers/EscPosDriver.test.ts
git commit -m "feat: add EscPosDriver.identify()"
```

---

### Task 8: `discoverProtocol()` Orchestration

**Files:**
- Create: `src/features/printer/services/discoverProtocol.ts`
- Test: `src/features/printer/services/discoverProtocol.test.ts`

**Interfaces:**
- Consumes: `IPrinterDriver` (Task 2), `PRINTER_DETECTION_RULES` (Task 3), `PrinterConfig`/`PrinterDevice`/`PrinterLanConfig`/`PrinterDeviceInfo`/`Protocol`/`ConnectionType` (Task 1), `AppError`
- Produces: `DiscoveryStage`, `DiscoveryEvent`, `DiscoveryInput`, `resolveCandidates(hintText, rules?)`, `createDiscoverProtocol(registry)` — consumed by `PrinterService` (Task 9).

- [ ] **Step 1: Write the failing tests**

```ts
// src/features/printer/services/discoverProtocol.test.ts
import { createDiscoverProtocol, resolveCandidates, type DiscoveryEvent } from './discoverProtocol';
import type { IPrinterDriver } from '../types/driver.types';
import type { PrinterDetectionRule } from '../constants/printerDetectionRules';
import type { Protocol } from '../types/printer.types';

const makeMockDriver = (overrides: Partial<jest.Mocked<IPrinterDriver>> = {}): jest.Mocked<IPrinterDriver> => ({
  scan: jest.fn().mockReturnValue(() => undefined),
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  getStatus: jest.fn().mockReturnValue('connected'),
  onStatusChange: jest.fn().mockReturnValue(() => undefined),
  testPrint: jest.fn().mockResolvedValue(undefined),
  identify: jest.fn().mockResolvedValue(null),
  ...overrides,
});

const collectEvents = (
  registry: Record<Protocol, IPrinterDriver>,
  input: Parameters<ReturnType<typeof createDiscoverProtocol>>[0],
): Promise<DiscoveryEvent[]> =>
  new Promise((resolve) => {
    const events: DiscoveryEvent[] = [];
    createDiscoverProtocol(registry)(input, (event) => {
      events.push(event);
      if (event.stage === 'identified' || event.stage === 'unknown_protocol' || event.stage === 'error') {
        resolve(events);
      }
    });
  });

describe('resolveCandidates', () => {
  const rules: PrinterDetectionRule[] = [
    { vendorMatch: /epson/i, candidates: ['escpos'], confidence: 'high' },
    { vendorMatch: /.*/, candidates: ['escpos', 'tspl'], confidence: 'low' },
  ];

  it('returns the matching rule candidates when the hint matches', () => {
    expect(resolveCandidates('Epson TM-T82', rules)).toEqual(['escpos']);
  });

  it('falls back to the catch-all rule when nothing else matches', () => {
    expect(resolveCandidates('Unknown Device', rules)).toEqual(['escpos', 'tspl']);
  });

  it('falls back to the catch-all rule when there is no hint at all (LAN)', () => {
    expect(resolveCandidates(undefined, rules)).toEqual(['escpos', 'tspl']);
  });
});

describe('discoverProtocol', () => {
  const baseInput = { printerId: 'p1', connectionType: 'lan' as const, lan: { ip: '192.168.1.10', port: 9100 } };

  it('emits identified when the first candidate connects and identifies successfully', async () => {
    const escposDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue({ deviceName: 'TM-T82' }) });
    const tsplDriver = makeMockDriver();
    const events = await collectEvents({ escpos: escposDriver, tspl: tsplDriver }, baseInput);

    expect(events.map((e) => e.stage)).toEqual(['connecting', 'identifying', 'identified']);
    expect(events[2].protocol).toBe('escpos');
    expect(events[2].deviceInfo).toEqual({ deviceName: 'TM-T82' });
    expect(escposDriver.disconnect).not.toHaveBeenCalled();
    expect(tsplDriver.connect).not.toHaveBeenCalled();
  });

  it('falls through to the next candidate when the first identify() returns null', async () => {
    const escposDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue(null) });
    const tsplDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue({}) });
    const events = await collectEvents({ escpos: escposDriver, tspl: tsplDriver }, baseInput);

    const identified = events.find((e) => e.stage === 'identified');
    expect(identified?.protocol).toBe('tspl');
    expect(escposDriver.disconnect).toHaveBeenCalledWith('p1');
  });

  it('emits unknown_protocol when every candidate connects but none identifies', async () => {
    const escposDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue(null) });
    const tsplDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue(null) });
    const events = await collectEvents({ escpos: escposDriver, tspl: tsplDriver }, baseInput);

    expect(events[events.length - 1].stage).toBe('unknown_protocol');
  });

  it('emits error when every candidate fails to even connect', async () => {
    const escposDriver = makeMockDriver({ connect: jest.fn().mockRejectedValue(new Error('down')) });
    const tsplDriver = makeMockDriver({ connect: jest.fn().mockRejectedValue(new Error('down')) });
    const events = await collectEvents({ escpos: escposDriver, tspl: tsplDriver }, baseInput);

    const last = events[events.length - 1];
    expect(last.stage).toBe('error');
    expect(last.error?.code).toBe('CONNECTION_ERROR');
  });

  it('unsubscribing before completion stops further events from being emitted', async () => {
    let resolveConnect: () => void = () => undefined;
    const escposDriver = makeMockDriver({
      connect: jest.fn().mockImplementation(() => new Promise<void>((resolve) => { resolveConnect = resolve; })),
    });
    const tsplDriver = makeMockDriver();
    const events: DiscoveryEvent[] = [];
    const unsubscribe = createDiscoverProtocol({ escpos: escposDriver, tspl: tsplDriver })(baseInput, (event) => {
      events.push(event);
    });
    unsubscribe();
    resolveConnect();
    await Promise.resolve();
    await Promise.resolve();
    expect(events.map((e) => e.stage)).toEqual(['connecting']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/features/printer/services/discoverProtocol.test.ts
```

Expected: FAIL — `Cannot find module './discoverProtocol'`.

- [ ] **Step 3: Write `discoverProtocol.ts`**

```ts
// src/features/printer/services/discoverProtocol.ts
import type { IPrinterDriver, Unsubscribe } from '../types/driver.types';
import type {
  ConnectionType,
  PrinterConfig,
  PrinterDevice,
  PrinterDeviceInfo,
  PrinterLanConfig,
  Protocol,
} from '../types/printer.types';
import type { AppError } from '../../../types/AppError';
import { PRINTER_DETECTION_RULES, type PrinterDetectionRule } from '../constants/printerDetectionRules';

export type DiscoveryStage = 'connecting' | 'identifying' | 'identified' | 'unknown_protocol' | 'error';

export interface DiscoveryEvent {
  stage: DiscoveryStage;
  protocol?: Protocol;
  deviceInfo?: PrinterDeviceInfo;
  error?: AppError;
}

export interface DiscoveryInput {
  printerId: string;
  connectionType: ConnectionType;
  device?: PrinterDevice;
  lan?: PrinterLanConfig;
}

/**
 * Tra `rules` theo `hintText` (tên/model thiết bị đã biết trước khi connect —
 * `undefined` cho LAN vì không có scan), trả về candidate list của luật khớp
 * đầu tiên. Luật fallback bắt-tất-cả đảm bảo luôn có kết quả.
 */
export const resolveCandidates = (
  hintText: string | undefined,
  rules: PrinterDetectionRule[] = PRINTER_DETECTION_RULES,
): Protocol[] => {
  const text = hintText ?? '';
  const rule = rules.find((r) => r.vendorMatch.test(text) && (!r.modelMatch || r.modelMatch.test(text)));
  return rule?.candidates ?? ['escpos', 'tspl'];
};

const buildDraftConfig = (input: DiscoveryInput, protocol: Protocol): PrinterConfig => ({
  id: input.printerId,
  printerName: input.device?.displayName ?? input.lan?.ip ?? 'Máy in mới',
  protocol,
  protocolSource: 'auto',
  connectionType: input.connectionType,
  paperSize: '80mm',
  autoReconnect: false,
  isDefault: false,
  device: input.device,
  lan: input.lan,
});

export const createDiscoverProtocol =
  (registry: Record<Protocol, IPrinterDriver>) =>
  (input: DiscoveryInput, onEvent: (event: DiscoveryEvent) => void): Unsubscribe => {
    let cancelled = false;

    const run = async (): Promise<void> => {
      const candidates = resolveCandidates(input.device?.displayName).filter((protocol) => Boolean(registry[protocol]));
      let connectFailures = 0;

      for (const protocol of candidates) {
        if (cancelled) return;
        const driver = registry[protocol];
        const config = buildDraftConfig(input, protocol);
        onEvent({ stage: 'connecting', protocol });
        try {
          await driver.connect(config);
        } catch {
          connectFailures += 1;
          continue;
        }
        if (cancelled) return;
        onEvent({ stage: 'identifying', protocol });
        const deviceInfo = await driver.identify(input.printerId).catch(() => null);
        if (cancelled) return;
        if (deviceInfo) {
          onEvent({ stage: 'identified', protocol, deviceInfo });
          return;
        }
        await driver.disconnect(input.printerId).catch(() => undefined);
      }

      if (cancelled) return;
      if (candidates.length > 0 && connectFailures === candidates.length) {
        onEvent({ stage: 'error', error: { code: 'CONNECTION_ERROR', message: 'Không thể kết nối tới máy in' } });
        return;
      }
      onEvent({ stage: 'unknown_protocol' });
    };

    run();

    return () => {
      cancelled = true;
    };
  };
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest src/features/printer/services/discoverProtocol.test.ts
```

Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/printer/services/discoverProtocol.ts src/features/printer/services/discoverProtocol.test.ts
git commit -m "feat: add discoverProtocol sequential-trial orchestration"
```

---

### Task 9: Wire `discoverProtocol` + `scanForConnectionType` + `connectDraft` into `PrinterService`

**Files:**
- Modify: `src/features/printer/services/PrinterService.ts`
- Modify: `src/features/printer/services/PrinterService.test.ts`

**Interfaces:**
- Consumes: `createDiscoverProtocol` (Task 8)
- Produces: `PrinterService.discoverProtocol`, `PrinterService.scanForConnectionType`, `PrinterService.connectDraft`, `PrinterService.getStatusForProtocol`, `PrinterService.onStatusChangeForProtocol` — consumed by `AddPrinterModal` (Task 12).

- [ ] **Step 1: Update the test fixture and add new tests**

In `PrinterService.test.ts`: change `printerType: 'receipt',` → `protocolSource: 'auto',` in `baseConfig`, add `identify: jest.fn().mockResolvedValue(null)` to `makeMockDriver()`'s return object, and append these tests inside the `describe('PrinterService', ...)` block:

```ts
  it('scanForConnectionType(usb) forwards to the escpos driver scan', () => {
    const escposDriver = makeMockDriver();
    const service = createPrinterService({ escpos: escposDriver, tspl: makeMockDriver() });
    const onEvent = jest.fn();
    service.scanForConnectionType('usb', onEvent);
    expect(escposDriver.scan).toHaveBeenCalledWith('usb', onEvent);
  });

  it('scanForConnectionType(bluetooth) forwards to the tspl driver scan', () => {
    const tsplDriver = makeMockDriver();
    const service = createPrinterService({ escpos: makeMockDriver(), tspl: tsplDriver });
    const onEvent = jest.fn();
    service.scanForConnectionType('bluetooth', onEvent);
    expect(tsplDriver.scan).toHaveBeenCalledWith('bluetooth', onEvent);
  });

  it('connectDraft() connects via the driver matching the draft config protocol without touching storage', async () => {
    const tsplDriver = makeMockDriver();
    const service = createPrinterService({ escpos: makeMockDriver(), tspl: tsplDriver });
    const draft: PrinterConfig = { ...baseConfig, id: 'draft-1', protocol: 'tspl' };
    await service.connectDraft(draft);
    expect(tsplDriver.connect).toHaveBeenCalledWith(draft);
    expect(service.getPrinters()).toEqual([]);
  });

  it('discoverProtocol() forwards to createDiscoverProtocol wired with the registry', async () => {
    const escposDriver = makeMockDriver({ identify: jest.fn().mockResolvedValue({ deviceName: 'X' }) });
    const service = createPrinterService({ escpos: escposDriver, tspl: makeMockDriver() });
    const events: string[] = [];
    await new Promise<void>((resolve) => {
      service.discoverProtocol({ printerId: 'p1', connectionType: 'lan', lan: { ip: '1.1.1.1', port: 9100 } }, (event) => {
        events.push(event.stage);
        if (event.stage === 'identified') resolve();
      });
    });
    expect(events).toEqual(['connecting', 'identifying', 'identified']);
  });
```

- [ ] **Step 2: Run test to verify the new tests fail**

```bash
npx jest src/features/printer/services/PrinterService.test.ts
```

Expected: FAIL — `service.scanForConnectionType is not a function` (and similarly for the other 3 new methods).

- [ ] **Step 3: Update `PrinterService.ts`**

```ts
// src/features/printer/services/PrinterService.ts
import { StorageService } from '../../../services/StorageService';
import type { IPrinterDriver, Unsubscribe } from '../types/driver.types';
import type {
  ConnectionType,
  DeviceScanEvent,
  PrinterConfig,
  PrinterStatus,
  Protocol,
} from '../types/printer.types';
import { DriverRegistry } from './DriverRegistry';
import { createDiscoverProtocol, type DiscoveryEvent, type DiscoveryInput } from './discoverProtocol';

const PRINTER_LIST_KEY = 'printer.list';
const PRINTER_DEFAULT_KEY = 'printer.defaultId';

export const createPrinterService = (registry: Record<Protocol, IPrinterDriver>) => {
  const getDriver = (protocol: Protocol): IPrinterDriver => registry[protocol];
  const discoverProtocolFn = createDiscoverProtocol(registry);

  const getPrinters = (): PrinterConfig[] => StorageService.getItem<PrinterConfig[]>(PRINTER_LIST_KEY) ?? [];

  const savePrinters = (printers: PrinterConfig[]): void => {
    StorageService.setItem(PRINTER_LIST_KEY, printers);
  };

  const findOrThrow = (printerId: string): PrinterConfig => {
    const found = getPrinters().find((p) => p.id === printerId);
    if (!found) throw new Error(`Không tìm thấy máy in với id ${printerId}`);
    return found;
  };

  const getDefaultPrinterId = (): string | null => StorageService.getItem<string>(PRINTER_DEFAULT_KEY);

  const addPrinter = (config: PrinterConfig): void => {
    savePrinters([...getPrinters(), config]);
    if (config.isDefault) StorageService.setItem(PRINTER_DEFAULT_KEY, config.id);
  };

  const updatePrinter = (config: PrinterConfig): void => {
    savePrinters(getPrinters().map((p) => (p.id === config.id ? config : p)));
  };

  const removePrinter = (printerId: string): void => {
    savePrinters(getPrinters().filter((p) => p.id !== printerId));
    if (getDefaultPrinterId() === printerId) StorageService.removeItem(PRINTER_DEFAULT_KEY);
  };

  const setDefault = (printerId: string): void => {
    savePrinters(getPrinters().map((p) => ({ ...p, isDefault: p.id === printerId })));
    StorageService.setItem(PRINTER_DEFAULT_KEY, printerId);
  };

  const connect = async (printerId: string): Promise<void> => {
    const config = findOrThrow(printerId);
    await getDriver(config.protocol).connect(config);
  };

  const disconnect = async (printerId: string): Promise<void> => {
    const config = findOrThrow(printerId);
    await getDriver(config.protocol).disconnect(printerId);
  };

  const reconnect = async (printerId: string): Promise<void> => {
    await disconnect(printerId).catch(() => undefined);
    await connect(printerId);
  };

  const testPrint = async (config: PrinterConfig): Promise<void> => {
    await getDriver(config.protocol).testPrint(config);
  };

  const scanDevices = (
    protocol: Protocol,
    connectionType: ConnectionType,
    onEvent: (event: DeviceScanEvent) => void,
  ): Unsubscribe => getDriver(protocol).scan(connectionType, onEvent);

  /**
   * Scan thiết bị cho wizard TRƯỚC khi biết protocol (mục "Key Architecture
   * Decision" đầu plan): Bluetooth dùng scan tổng quát của TsplDriver
   * (RNBluetoothClassic trực tiếp, không phụ thuộc SDK hãng nào); USB chỉ
   * EscPosDriver hỗ trợ scan (TsplDriver luôn báo lỗi UNSUPPORTED_CONNECTION
   * cho USB — kiến trúc TSPL-qua-USB chưa được hỗ trợ, Phase 1 §4.3).
   */
  const scanForConnectionType = (
    connectionType: ConnectionType,
    onEvent: (event: DeviceScanEvent) => void,
  ): Unsubscribe => {
    if (connectionType === 'usb') return getDriver('escpos').scan('usb', onEvent);
    if (connectionType === 'bluetooth') return getDriver('tspl').scan('bluetooth', onEvent);
    return getDriver('tspl').scan('lan', onEvent);
  };

  /**
   * Connect thẳng bằng driver ứng với `config.protocol`, KHÔNG đọc/ghi
   * storage — dùng khi wizard đã biết protocol (do người dùng chọn thủ công
   * sau khi discoverProtocol() trả `unknown_protocol`) nhưng máy in chưa
   * được lưu (`addPrinter`/`updatePrinter`) nên `findOrThrow` sẽ không tìm
   * thấy.
   */
  const connectDraft = async (config: PrinterConfig): Promise<void> => {
    await getDriver(config.protocol).connect(config);
  };

  const getStatus = (printerId: string): PrinterStatus => {
    const config = findOrThrow(printerId);
    return getDriver(config.protocol).getStatus(printerId);
  };

  const onStatusChange = (printerId: string, callback: (status: PrinterStatus) => void): Unsubscribe => {
    const config = findOrThrow(printerId);
    return getDriver(config.protocol).onStatusChange(printerId, callback);
  };

  /**
   * Biến thể của `getStatus`/`onStatusChange` dùng khi `printerId` chưa được
   * lưu vào storage (trong lúc wizard đang chạy) nên không thể tra `protocol`
   * qua `findOrThrow` — protocol đã biết trực tiếp từ `discoverProtocol()`.
   */
  const getStatusForProtocol = (protocol: Protocol, printerId: string): PrinterStatus =>
    getDriver(protocol).getStatus(printerId);

  const onStatusChangeForProtocol = (
    protocol: Protocol,
    printerId: string,
    callback: (status: PrinterStatus) => void,
  ): Unsubscribe => getDriver(protocol).onStatusChange(printerId, callback);

  const discoverProtocol = (input: DiscoveryInput, onEvent: (event: DiscoveryEvent) => void): Unsubscribe =>
    discoverProtocolFn(input, onEvent);

  return {
    getPrinters,
    getDefaultPrinterId,
    addPrinter,
    updatePrinter,
    removePrinter,
    setDefault,
    connect,
    disconnect,
    reconnect,
    testPrint,
    scanDevices,
    scanForConnectionType,
    connectDraft,
    getStatus,
    onStatusChange,
    getStatusForProtocol,
    onStatusChangeForProtocol,
    discoverProtocol,
  };
};

export const PrinterService = createPrinterService(DriverRegistry);
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest src/features/printer/services/PrinterService.test.ts
```

Expected: PASS (10 tests — 6 existing + 4 new).

- [ ] **Step 5: Fix the other two fixtures broken by the `printerType` removal**

Edit `src/features/printer/store/printerSlice.test.ts`: change `printerType: 'receipt',` → `protocolSource: 'auto',` in the `printer` fixture.

Run:

```bash
npx jest src/features/printer/store/printerSlice.test.ts
```

Expected: PASS (5 tests, unchanged behavior).

- [ ] **Step 6: Commit**

```bash
git add src/features/printer/services/PrinterService.ts src/features/printer/services/PrinterService.test.ts src/features/printer/store/printerSlice.test.ts
git commit -m "feat: wire discoverProtocol, scanForConnectionType, connectDraft into PrinterService"
```

---

### Task 10: `printerFormSchema` — Wizard-Step Schemas

**Files:**
- Modify: `src/features/printer/schemas/printerFormSchema.ts`
- Modify: `src/features/printer/schemas/printerFormSchema.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `lanConnectionSchema`/`LanConnectionValues`, `printerDisplaySchema`/`PrinterDisplayValues` — consumed by `AddPrinterModal` (Task 13). Replaces the old single `printerFormSchema`/`PrinterFormValues` (no longer needed — the wizard validates per-step, not one big form).

- [ ] **Step 1: Rewrite the failing tests**

```ts
// src/features/printer/schemas/printerFormSchema.test.ts
import { lanConnectionSchema, printerDisplaySchema } from './printerFormSchema';

describe('lanConnectionSchema', () => {
  it('accepts a valid IP and port', () => {
    const result = lanConnectionSchema.safeParse({ lanIp: '192.168.1.20', lanPort: '9100' });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid IP', () => {
    const result = lanConnectionSchema.safeParse({ lanIp: 'not-an-ip', lanPort: '9100' });
    expect(result.success).toBe(false);
  });

  it('rejects an out-of-range port', () => {
    const result = lanConnectionSchema.safeParse({ lanIp: '192.168.1.20', lanPort: '70000' });
    expect(result.success).toBe(false);
  });

  it('rejects a non-numeric port', () => {
    const result = lanConnectionSchema.safeParse({ lanIp: '192.168.1.20', lanPort: 'abc' });
    expect(result.success).toBe(false);
  });
});

describe('printerDisplaySchema', () => {
  it('accepts a valid display name and paper size', () => {
    const result = printerDisplaySchema.safeParse({ printerName: 'Máy in quầy 1', paperSize: '80mm' });
    expect(result.success).toBe(true);
  });

  it('rejects an empty printer name', () => {
    const result = printerDisplaySchema.safeParse({ printerName: '', paperSize: '80mm' });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/features/printer/schemas/printerFormSchema.test.ts
```

Expected: FAIL — `lanConnectionSchema`/`printerDisplaySchema` don't exist yet.

- [ ] **Step 3: Rewrite `printerFormSchema.ts`**

```ts
// src/features/printer/schemas/printerFormSchema.ts
import { z } from 'zod';

const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

const isValidIpv4 = (value: string): boolean => {
  if (!ipv4Regex.test(value)) return false;
  return value.split('.').every((segment) => Number(segment) >= 0 && Number(segment) <= 255);
};

const isValidPort = (value: string): boolean => {
  const port = Number(value);
  return value.length > 0 && !Number.isNaN(port) && port >= 1 && port <= 65535;
};

export const lanConnectionSchema = z.object({
  lanIp: z.string().refine(isValidIpv4, 'Địa chỉ IP không hợp lệ'),
  lanPort: z.string().refine(isValidPort, 'Cổng không hợp lệ (1-65535)'),
});

export type LanConnectionValues = z.infer<typeof lanConnectionSchema>;

export const printerDisplaySchema = z.object({
  printerName: z.string().min(1, 'Vui lòng nhập tên máy in'),
  paperSize: z.enum(['58mm', '80mm']),
});

export type PrinterDisplayValues = z.infer<typeof printerDisplaySchema>;
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest src/features/printer/schemas/printerFormSchema.test.ts
```

Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/printer/schemas/printerFormSchema.ts src/features/printer/schemas/printerFormSchema.test.ts
git commit -m "feat: replace monolithic printerFormSchema with per-step wizard schemas"
```

---

### Task 11: `DeviceScanList` — Remove The `protocol` Prop

**Files:**
- Modify: `src/features/printer/components/DeviceScanList.tsx`

**Interfaces:**
- Consumes: `PrinterService.scanForConnectionType` (Task 9)
- Produces: `DeviceScanList` without a `protocol` prop — consumed by `AddPrinterModal` (Task 13).

- [ ] **Step 1: Update `DeviceScanList.tsx`**

```tsx
// src/features/printer/components/DeviceScanList.tsx
import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { List, IconButton, Text } from 'react-native-paper';
import { PrinterService } from '../services/PrinterService';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingOverlay } from '../../../components/LoadingOverlay';
import type { ConnectionType, PrinterDevice } from '../types/printer.types';

export interface DeviceScanListProps {
  connectionType: ConnectionType;
  selectedDeviceId?: string;
  onSelect: (device: PrinterDevice) => void;
}

export const DeviceScanList: React.FC<DeviceScanListProps> = ({
  connectionType,
  selectedDeviceId,
  onSelect,
}) => {
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState<PrinterDevice[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scanTrigger, setScanTrigger] = useState(0);

  useEffect(() => {
    setLoading(true);
    setErrorMessage(null);
    const unsubscribe = PrinterService.scanForConnectionType(connectionType, (event) => {
      if (event.type === 'loading') setLoading(true);
      if (event.type === 'found' || event.type === 'empty') {
        setLoading(false);
        setDevices(event.devices ?? []);
      }
      if (event.type === 'error') {
        setLoading(false);
        setErrorMessage(event.error?.message ?? 'Không thể quét thiết bị');
      }
    });
    return unsubscribe;
  }, [connectionType, scanTrigger]);

  return (
    <View>
      <View style={styles.header}>
        <Text variant="labelMedium">Thiết bị tìm thấy</Text>
        <IconButton icon="refresh" size={16} onPress={() => setScanTrigger((n) => n + 1)} />
      </View>
      {loading && <LoadingOverlay />}
      {!loading && errorMessage && <EmptyState message={errorMessage} />}
      {!loading && !errorMessage && devices.length === 0 && <EmptyState message="Không tìm thấy thiết bị nào" />}
      {!loading &&
        !errorMessage &&
        devices.map((device) => (
          <List.Item
            key={device.deviceId}
            title={device.displayName}
            onPress={() => onSelect(device)}
            // eslint-disable-next-line react/no-unstable-nested-components -- render-prop for List.Item's `right` slot, not a real component definition
            right={() => (selectedDeviceId === device.deviceId ? <List.Icon icon="check" /> : null)}
          />
        ))}
    </View>
  );
};

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: errors only in `AddPrinterModal.tsx` (fixed in Task 13) — `DeviceScanList.tsx` itself compiles clean.

- [ ] **Step 3: Commit**

```bash
git add src/features/printer/components/DeviceScanList.tsx
git commit -m "refactor: DeviceScanList no longer requires a protocol prop"
```

---

### Task 12: `PrinterInfoCard` Component

**Files:**
- Create: `src/features/printer/components/PrinterInfoCard.tsx`

**Interfaces:**
- Consumes: `AppInput`/`AppSelect`/`AppSwitch`/`AppButton` (shared components), `PrinterStatusBadge` (existing), `PrinterDeviceInfo`/`Protocol`/`ProtocolSource`/`ConnectionType`/`PaperSize`/`PrinterStatus` (Task 1), `printerDisplaySchema`/`PrinterDisplayValues` (Task 10)
- Produces: `PrinterInfoCard` — consumed by `AddPrinterModal` (Task 13). No test file (UI component, matches this codebase's existing convention of not unit-testing Paper-based screens/modals).

- [ ] **Step 1: Write `PrinterInfoCard.tsx`**

```tsx
// src/features/printer/components/PrinterInfoCard.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Chip } from 'react-native-paper';
import { Controller, type Control, type FieldErrors } from 'react-hook-form';
import { AppInput } from '../../../components/AppInput';
import { AppSelect } from '../../../components/AppSelect';
import { AppSwitch } from '../../../components/AppSwitch';
import { AppButton } from '../../../components/AppButton';
import { PrinterStatusBadge } from './PrinterStatusBadge';
import type { PrinterDisplayValues } from '../schemas/printerFormSchema';
import type { ConnectionType, PrinterDeviceInfo, PrinterStatus, Protocol, ProtocolSource } from '../types/printer.types';

const connectionLabel: Record<ConnectionType, string> = {
  usb: 'USB',
  bluetooth: 'Bluetooth',
  lan: 'LAN',
};

const protocolLabel: Record<Protocol, string> = {
  escpos: 'ESC/POS',
  tspl: 'TSPL',
};

export interface PrinterInfoCardProps {
  control: Control<PrinterDisplayValues>;
  errors: FieldErrors<PrinterDisplayValues>;
  connectionType: ConnectionType;
  protocol: Protocol;
  protocolSource: ProtocolSource;
  deviceInfo?: PrinterDeviceInfo;
  status: PrinterStatus;
  autoReconnect: boolean;
  onAutoReconnectChange: (value: boolean) => void;
  canTestPrint: boolean;
  testPrintPending: boolean;
  onTestPrint: () => void;
  onSave: () => void;
  saveDisabled: boolean;
}

export const PrinterInfoCard: React.FC<PrinterInfoCardProps> = ({
  control,
  errors,
  connectionType,
  protocol,
  protocolSource,
  deviceInfo,
  status,
  autoReconnect,
  onAutoReconnectChange,
  canTestPrint,
  testPrintPending,
  onTestPrint,
  onSave,
  saveDisabled,
}) => (
  <View style={styles.container}>
    <Controller
      control={control}
      name="printerName"
      render={({ field }) => (
        <AppInput
          label="Tên hiển thị"
          value={field.value}
          onChangeText={field.onChange}
          errorMessage={errors.printerName?.message}
        />
      )}
    />

    {deviceInfo?.deviceName ? (
      <Text variant="bodySmall">Device Name: {deviceInfo.deviceName}</Text>
    ) : null}
    {deviceInfo?.vendor ? <Text variant="bodySmall">Vendor: {deviceInfo.vendor}</Text> : null}
    {deviceInfo?.model ? <Text variant="bodySmall">Model: {deviceInfo.model}</Text> : null}
    <Text variant="bodySmall">Connection Type: {connectionLabel[connectionType]}</Text>

    <View style={styles.row}>
      <Chip>{`Protocol: ${protocolLabel[protocol]}`}</Chip>
      <Chip>{protocolSource === 'auto' ? 'Tự động nhận diện' : 'Người dùng chọn'}</Chip>
      <PrinterStatusBadge status={status} />
    </View>

    <Controller
      control={control}
      name="paperSize"
      render={({ field }) => (
        <AppSelect
          label="Khổ giấy"
          value={field.value}
          onSelect={field.onChange}
          options={[
            { label: '58mm', value: '58mm' },
            { label: '80mm', value: '80mm' },
          ]}
        />
      )}
    />

    <AppSwitch label="Tự động kết nối lại" value={autoReconnect} onValueChange={onAutoReconnectChange} />

    <View style={styles.footer}>
      <AppButton
        label="In thử"
        mode="outlined"
        disabled={status !== 'connected' || testPrintPending}
        loading={testPrintPending}
        onPress={onTestPrint}
      />
      <AppButton label="Lưu máy in" disabled={saveDisabled || !canTestPrint} onPress={onSave} />
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: { gap: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  footer: { flexDirection: 'row', gap: 8, marginTop: 8 },
});
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no new errors from this file (remaining errors are `AddPrinterModal.tsx`, fixed in Task 13).

- [ ] **Step 3: Commit**

```bash
git add src/features/printer/components/PrinterInfoCard.tsx
git commit -m "feat: add PrinterInfoCard component for the connect wizard"
```

---

### Task 13: `AddPrinterModal` — Wizard Rewrite

**Files:**
- Modify: `src/features/printer/components/AddPrinterModal.tsx`

**Interfaces:**
- Consumes: `PrinterService.{scanForConnectionType, discoverProtocol, connectDraft, testPrint, addPrinter, updatePrinter, getStatusForProtocol, onStatusChangeForProtocol}` (Task 9), `DeviceScanList` (Task 11), `PrinterInfoCard` (Task 12), `lanConnectionSchema`/`printerDisplaySchema` (Task 10), `generateId` (existing util)
- Produces: `AddPrinterModal` — consumed by `PrinterManagementPanel` (existing, unchanged call site since props stay `{ visible, initialValues, onDismiss, onSaved }`).

- [ ] **Step 1: Rewrite `AddPrinterModal.tsx`**

```tsx
// src/features/printer/components/AddPrinterModal.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Modal, Portal, Text, SegmentedButtons } from 'react-native-paper';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AppInput } from '../../../components/AppInput';
import { AppButton } from '../../../components/AppButton';
import { LoadingOverlay } from '../../../components/LoadingOverlay';
import { PrinterService } from '../services/PrinterService';
import { generateId } from '../../../utils/id';
import {
  lanConnectionSchema,
  printerDisplaySchema,
  type LanConnectionValues,
  type PrinterDisplayValues,
} from '../schemas/printerFormSchema';
import { DeviceScanList } from './DeviceScanList';
import { PrinterInfoCard } from './PrinterInfoCard';
import type { DiscoveryEvent } from '../services/discoverProtocol';
import type { AppError } from '../../../types/AppError';
import type {
  ConnectionType,
  PrinterConfig,
  PrinterDevice,
  PrinterDeviceInfo,
  PrinterStatus,
  Protocol,
  ProtocolSource,
} from '../types/printer.types';

export interface AddPrinterModalProps {
  visible: boolean;
  initialValues?: PrinterConfig;
  onDismiss: () => void;
  onSaved: () => void;
}

type WizardStep =
  | { name: 'selectConnection' }
  | { name: 'selectDevice' }
  | { name: 'connecting' }
  | { name: 'chooseProtocol' }
  | { name: 'identified'; protocol: Protocol; protocolSource: ProtocolSource; deviceInfo?: PrinterDeviceInfo }
  | { name: 'error'; error: AppError };

const protocolChoices: Array<{ value: Protocol; label: string }> = [
  { value: 'escpos', label: 'ESC/POS' },
  { value: 'tspl', label: 'TSPL' },
];

export const AddPrinterModal: React.FC<AddPrinterModalProps> = ({ visible, initialValues, onDismiss, onSaved }) => {
  const printerId = useMemo(() => initialValues?.id ?? generateId(), [initialValues?.id]);
  const [connectionType, setConnectionType] = useState<ConnectionType>(initialValues?.connectionType ?? 'usb');
  const [selectedDevice, setSelectedDevice] = useState<PrinterDevice | undefined>(initialValues?.device);
  const [autoReconnect, setAutoReconnect] = useState(initialValues?.autoReconnect ?? true);
  const [canTestPrint, setCanTestPrint] = useState(Boolean(initialValues));
  const [testPrintPending, setTestPrintPending] = useState(false);
  const [liveStatus, setLiveStatus] = useState<PrinterStatus>('idle');

  const [step, setStep] = useState<WizardStep>(
    initialValues
      ? {
          name: 'identified',
          protocol: initialValues.protocol,
          protocolSource: initialValues.protocolSource,
          deviceInfo: initialValues.deviceInfo,
        }
      : { name: 'selectConnection' },
  );

  const lanForm = useForm<LanConnectionValues>({
    resolver: zodResolver(lanConnectionSchema),
    defaultValues: {
      lanIp: initialValues?.lan?.ip ?? '',
      lanPort: initialValues?.lan?.port ? String(initialValues.lan.port) : '',
    },
  });

  const displayForm = useForm<PrinterDisplayValues>({
    resolver: zodResolver(printerDisplaySchema),
    defaultValues: {
      printerName: initialValues?.printerName ?? '',
      paperSize: initialValues?.paperSize ?? '80mm',
    },
  });

  useEffect(() => {
    if (step.name !== 'identified') return undefined;
    setLiveStatus(PrinterService.getStatusForProtocol(step.protocol, printerId));
    return PrinterService.onStatusChangeForProtocol(step.protocol, printerId, setLiveStatus);
  }, [step, printerId]);

  const buildLan = (values: LanConnectionValues) => ({ ip: values.lanIp, port: Number(values.lanPort) });

  const startDiscovery = (lan?: { ip: string; port: number }): void => {
    setCanTestPrint(false);
    setStep({ name: 'connecting' });
    PrinterService.discoverProtocol(
      {
        printerId,
        connectionType,
        device: connectionType === 'lan' ? undefined : selectedDevice,
        lan,
      },
      (event: DiscoveryEvent) => {
        if (event.stage === 'identified' && event.protocol) {
          setStep({ name: 'identified', protocol: event.protocol, protocolSource: 'auto', deviceInfo: event.deviceInfo });
          if (!displayForm.getValues('printerName')) {
            displayForm.setValue(
              'printerName',
              event.deviceInfo?.deviceName ?? selectedDevice?.displayName ?? 'Máy in mới',
            );
          }
        } else if (event.stage === 'unknown_protocol') {
          setStep({ name: 'chooseProtocol' });
        } else if (event.stage === 'error' && event.error) {
          setStep({ name: 'error', error: event.error });
        }
      },
    );
  };

  const onConnectPress = (): void => {
    if (connectionType === 'lan') {
      lanForm.handleSubmit((values) => startDiscovery(buildLan(values)))();
    } else {
      startDiscovery(undefined);
    }
  };

  const onChooseProtocol = (protocol: Protocol): void => {
    setStep({ name: 'connecting' });
    const config: PrinterConfig = {
      id: printerId,
      printerName: 'Máy in mới',
      protocol,
      protocolSource: 'manual',
      connectionType,
      paperSize: '80mm',
      autoReconnect: false,
      isDefault: false,
      device: connectionType === 'lan' ? undefined : selectedDevice,
      lan: connectionType === 'lan' ? buildLan(lanForm.getValues()) : undefined,
    };
    PrinterService.connectDraft(config)
      .then(() => setStep({ name: 'identified', protocol, protocolSource: 'manual', deviceInfo: undefined }))
      .catch((error: AppError) => setStep({ name: 'error', error }));
  };

  const buildFinalConfig = (protocol: Protocol, protocolSource: ProtocolSource, deviceInfo?: PrinterDeviceInfo): PrinterConfig => {
    const display = displayForm.getValues();
    return {
      id: printerId,
      printerName: display.printerName,
      protocol,
      protocolSource,
      connectionType,
      paperSize: display.paperSize,
      autoReconnect,
      isDefault: initialValues?.isDefault ?? false,
      device: connectionType === 'lan' ? undefined : selectedDevice,
      lan: connectionType === 'lan' ? buildLan(lanForm.getValues()) : undefined,
      deviceInfo,
    };
  };

  const onTestPrint = async (): Promise<void> => {
    if (step.name !== 'identified') return;
    const valid = await displayForm.trigger();
    if (!valid) return;
    setTestPrintPending(true);
    try {
      await PrinterService.testPrint(buildFinalConfig(step.protocol, step.protocolSource, step.deviceInfo));
      setCanTestPrint(true);
    } catch {
      setCanTestPrint(false);
    } finally {
      setTestPrintPending(false);
    }
  };

  const onSave = displayForm.handleSubmit(() => {
    if (step.name !== 'identified' || !canTestPrint) return;
    const config = buildFinalConfig(step.protocol, step.protocolSource, step.deviceInfo);
    if (initialValues) PrinterService.updatePrinter(config);
    else PrinterService.addPrinter(config);
    onSaved();
  });

  const onChangeConnection = (): void => {
    setStep({ name: 'selectConnection' });
    setSelectedDevice(undefined);
    setCanTestPrint(false);
  };

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.container}>
        <Text variant="titleMedium">{initialValues ? 'Chỉnh sửa máy in' : 'Thêm máy in'}</Text>

        {step.name === 'selectConnection' && (
          <View style={styles.stepGap}>
            <SegmentedButtons
              value={connectionType}
              onValueChange={(value) => setConnectionType(value as ConnectionType)}
              buttons={[
                { value: 'usb', label: 'USB' },
                { value: 'bluetooth', label: 'Bluetooth' },
                { value: 'lan', label: 'LAN' },
              ]}
            />
            <AppButton label="Tiếp tục" onPress={() => setStep({ name: 'selectDevice' })} />
          </View>
        )}

        {step.name === 'selectDevice' && (
          <View style={styles.stepGap}>
            {connectionType === 'lan' ? (
              <>
                <AppInput
                  label="Địa chỉ IP"
                  value={lanForm.watch('lanIp')}
                  onChangeText={(text) => lanForm.setValue('lanIp', text)}
                  errorMessage={lanForm.formState.errors.lanIp?.message}
                />
                <AppInput
                  label="Cổng"
                  value={lanForm.watch('lanPort')}
                  onChangeText={(text) => lanForm.setValue('lanPort', text)}
                  keyboardType="numeric"
                  errorMessage={lanForm.formState.errors.lanPort?.message}
                />
              </>
            ) : (
              <DeviceScanList
                connectionType={connectionType}
                selectedDeviceId={selectedDevice?.deviceId}
                onSelect={setSelectedDevice}
              />
            )}
            <AppButton
              label="Kết nối"
              onPress={onConnectPress}
              disabled={connectionType !== 'lan' && !selectedDevice}
            />
          </View>
        )}

        {step.name === 'connecting' && (
          <View style={styles.stepGap}>
            <LoadingOverlay />
            <Text variant="bodyMedium">Đang kết nối và nhận diện máy in...</Text>
          </View>
        )}

        {step.name === 'chooseProtocol' && (
          <View style={styles.stepGap}>
            <Text variant="bodyMedium">Không thể tự nhận diện Protocol. Vui lòng chọn thủ công:</Text>
            <SegmentedButtons
              value=""
              onValueChange={(value) => onChooseProtocol(value as Protocol)}
              buttons={protocolChoices}
            />
          </View>
        )}

        {step.name === 'error' && (
          <View style={styles.stepGap}>
            <Text variant="bodyMedium">{step.error.message}</Text>
            <AppButton label="Thử lại" onPress={() => setStep({ name: 'selectDevice' })} />
          </View>
        )}

        {step.name === 'identified' && (
          <View style={styles.stepGap}>
            <PrinterInfoCard
              control={displayForm.control}
              errors={displayForm.formState.errors}
              connectionType={connectionType}
              protocol={step.protocol}
              protocolSource={step.protocolSource}
              deviceInfo={step.deviceInfo}
              status={liveStatus}
              autoReconnect={autoReconnect}
              onAutoReconnectChange={setAutoReconnect}
              canTestPrint={canTestPrint}
              testPrintPending={testPrintPending}
              onTestPrint={onTestPrint}
              onSave={onSave}
              saveDisabled={liveStatus !== 'connected'}
            />
            <AppButton label="Đổi kết nối" mode="outlined" onPress={onChangeConnection} />
          </View>
        )}
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  container: { backgroundColor: 'white', margin: 24, padding: 16, borderRadius: 16, gap: 12 },
  stepGap: { gap: 12 },
});
```

- [ ] **Step 2: Full type-check**

```bash
npx tsc --noEmit
```

Expected: no errors anywhere in `src/`.

- [ ] **Step 3: Lint**

```bash
npm run lint
```

Expected: no errors. Fix any `react-hooks/exhaustive-deps` or unused-import warnings this file introduces before moving on — do not suppress with blanket `eslint-disable` comments.

- [ ] **Step 4: Commit**

```bash
git add src/features/printer/components/AddPrinterModal.tsx
git commit -m "feat: rewrite AddPrinterModal as a connect-first wizard"
```

---

### Task 14: Full Verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full automated suite**

```bash
npx tsc --noEmit
npm run lint
npx jest --watchAll=false
```

Expected: type-check clean, lint clean, every test suite passes — including every test updated/added across Tasks 1–13.

- [ ] **Step 2: Manual verification (requires Android SDK/emulator or device)**

Walk through, on the running app: Settings → "Quản lý máy in" → "Thêm máy in" → chọn LAN → nhập IP/Port của 1 máy in ESC/POS hoặc TSPL thật → "Kết nối" → xác nhận wizard hiển thị đúng nhánh (`identified` nếu nhận diện được, `chooseProtocol` nếu không) → "In thử" → "Lưu máy in" → xác nhận máy in mới xuất hiện trong danh sách với `PrinterStatusBadge` đúng trạng thái. **This step needs a real Android device/emulator and a physical printer — if unavailable, tell the user explicitly this step was not run and ask them to verify**, per spec §7.

- [ ] **Step 3: Commit (if Step 2 uncovered fixes)**

Only if manual testing required code changes — otherwise this task produces no commit, Task 13's commit is the final one.

---

## Self-Review Notes

- **Spec coverage:** §3 data model → Task 1; §4.1 `identify()` contract → Task 2, 6, 7; §4.2 `discoverProtocol` algorithm → Task 8, wired in Task 9; §4.3 detection rules → Task 3; §5 wizard UI/UX (all 6 steps, Info Card fields, edit-flow rule) → Tasks 10–13; §6 error handling (`unknown_protocol` vs `error` distinction) → Task 8; §7 testing strategy → every task's own tests + Task 14's hardware caveat; §8 risks → called out inline in Task 6 (TSPL identify), Task 7 (ESC/POS identify), and the "Key Architecture Decision" section (scan source, not explicitly in the spec — flagged for review).
- **Placeholder scan:** no "TODO"/"handle later" language in any task's code — the one `// TODO` comment that exists is inside `PRINTER_DETECTION_RULES` itself (Task 3), copied verbatim from the approved spec, marking a genuinely-unknown future data gap, not deferred implementation work.
- **Type consistency:** `PrinterDeviceInfo`, `ProtocolSource`, `IPrinterDriver.identify`, `DiscoveryEvent`/`DiscoveryInput`/`DiscoveryStage`, `PrinterService.{discoverProtocol, scanForConnectionType, connectDraft, getStatusForProtocol, onStatusChangeForProtocol}` are the exact names/shapes defined in Tasks 1–2, 8–9 and used unchanged through Tasks 6–7 (drivers) and 11–13 (UI) — verified no renamed fields.
- **Existing behavior preserved:** `PrinterListItem`'s menu actions, `PrinterManagementPanel`, `printerSlice`, `usePrinterConnection`, `PrinterStatusBadge` are untouched (confirmed via `printerType` grep — none of them reference the removed field), matching the spec's §5.4 "không đổi so với Phase 1".
