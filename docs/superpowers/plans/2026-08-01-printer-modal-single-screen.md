# Printer Modal Single-Screen Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the step-based `AddPrinterModal` wizard with a single, always-visible, scrollable modal where sections are disabled (not hidden) until their prerequisites are met — no business logic changes.

**Architecture:** `WizardStep` is replaced by two independent state axes (`ConnectionState`, `ProtocolState`) in `AddPrinterModal`. Two new presentational components (`ConnectionSection`, `StatusPanel`) are extracted; `PrinterInfoCard` gains a `locked` prop instead of being conditionally mounted. `discoverProtocol()`/`PrinterService` are untouched — only how the UI maps `DiscoveryEvent`s onto local state changes.

**Tech Stack:** Same as existing feature — React Native, TypeScript strict, React Hook Form + Zod, React Native Paper.

**Spec:** `docs/superpowers/specs/2026-08-01-printer-modal-single-screen-design.md`

**All file paths in this plan are relative to the `NDTCore.App/` repo root.**

## Global Constraints

- TypeScript strict mode; never use `any`.
- No component/hook may call a printer SDK/native module directly — everything goes through `PrinterService`.
- Printer connection status is event-driven; no polling anywhere.
- All user-facing text is Vietnamese.
- `discoverProtocol.ts`, `PrinterService.ts`, `TsplDriver.ts`, `EscPosDriver.ts`, `printerFormSchema.ts` are **out of scope** — do not modify.
- Follow this codebase's established test convention: components under `src/components/` and `src/features/printer/components/` have no dedicated test file (verified via `npx tsc --noEmit` + `npm run lint` + manual device testing) — only logic-heavy modules (services, drivers, schemas, reducers) get unit tests. None of this plan's tasks touch a logic-heavy module, so no task in this plan adds a test file.
- **Learned the hard way in the previous plan:** an effect whose cleanup unconditionally cancels an in-flight async operation (e.g. calling a stored `Unsubscribe`) must NOT have that operation's own trigger-state in its dependency array, or React re-running the effect on that state's own transition self-cancels the operation it just started. Where this plan needs "read the latest X when the modal is dismissed" without X in the effect's deps, it uses a ref synced by a separate small effect — same pattern as the emergency fix in the previous plan (`AddPrinterModal.tsx`'s `stepRef`).

---

## File Structure

```text
src/
├── components/
│   ├── AppInput.tsx                        # Task 1 — add `disabled`
│   ├── AppSelect.tsx                       # Task 2 — add `disabled`
│   └── AppSwitch.tsx                        # Task 3 — add `disabled`
└── features/
    └── printer/
        └── components/
            ├── DeviceScanList.tsx            # Task 4 — 30s scan timeout
            ├── StatusPanel.tsx                # Task 5 — NEW, exports ConnectionState/ProtocolState
            ├── ConnectionSection.tsx           # Task 6 — NEW
            ├── PrinterInfoCard.tsx              # Task 7 — add `locked`, protocol/protocolSource optional
            └── AddPrinterModal.tsx               # Task 8 — full rewrite
```

---

### Task 1: `AppInput` — add `disabled` prop

**Files:**
- Modify: `src/components/AppInput.tsx`

**Interfaces:**
- Consumes: nothing new
- Produces: `AppInputProps.disabled?: boolean` (default `false`) — consumed by `PrinterInfoCard` (Task 7) and `ConnectionSection` (Task 6, passthrough only, not locked there).

- [ ] **Step 1: Update `AppInput.tsx`**

```tsx
// src/components/AppInput.tsx
import React from 'react';
import { TextInput, HelperText } from 'react-native-paper';
import { View } from 'react-native';

export interface AppInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  errorMessage?: string;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad';
  placeholder?: string;
  disabled?: boolean;
}

export const AppInput: React.FC<AppInputProps> = ({
  label,
  value,
  onChangeText,
  errorMessage,
  keyboardType = 'default',
  placeholder,
  disabled = false,
}) => (
  <View>
    <TextInput
      label={label}
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
      placeholder={placeholder}
      error={Boolean(errorMessage)}
      mode="outlined"
      disabled={disabled}
    />
    {errorMessage ? <HelperText type="error">{errorMessage}</HelperText> : null}
  </View>
);
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no new errors (existing call sites don't pass `disabled`, which is optional).

- [ ] **Step 3: Commit**

```bash
git add src/components/AppInput.tsx
git commit -m "feat: add disabled prop to AppInput"
```

---

### Task 2: `AppSelect` — add `disabled` prop

**Files:**
- Modify: `src/components/AppSelect.tsx`

**Interfaces:**
- Consumes: nothing new
- Produces: `AppSelectProps<T>.disabled?: boolean` (default `false`) — consumed by `PrinterInfoCard` (Task 7).

- [ ] **Step 1: Update `AppSelect.tsx`**

```tsx
// src/components/AppSelect.tsx
import React, { useState } from 'react';
import { Menu, TextInput, TouchableRipple } from 'react-native-paper';

export interface AppSelectOption<T extends string> {
  label: string;
  value: T;
}

export interface AppSelectProps<T extends string> {
  label: string;
  value: T | undefined;
  options: Array<AppSelectOption<T>>;
  onSelect: (value: T) => void;
  disabled?: boolean;
}

export function AppSelect<T extends string>({
  label,
  value,
  options,
  onSelect,
  disabled = false,
}: AppSelectProps<T>): React.JSX.Element {
  const [visible, setVisible] = useState(false);
  const selectedLabel = options.find((o) => o.value === value)?.label ?? '';

  return (
    <Menu
      visible={visible}
      onDismiss={() => setVisible(false)}
      anchor={
        <TouchableRipple onPress={() => setVisible(true)} disabled={disabled}>
          <TextInput label={label} value={selectedLabel} editable={false} mode="outlined" disabled={disabled} />
        </TouchableRipple>
      }
    >
      {options.map((option) => (
        <Menu.Item
          key={option.value}
          title={option.label}
          onPress={() => {
            onSelect(option.value);
            setVisible(false);
          }}
        />
      ))}
    </Menu>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/AppSelect.tsx
git commit -m "feat: add disabled prop to AppSelect"
```

---

### Task 3: `AppSwitch` — add `disabled` prop

**Files:**
- Modify: `src/components/AppSwitch.tsx`

**Interfaces:**
- Consumes: nothing new
- Produces: `AppSwitchProps.disabled?: boolean` (default `false`) — consumed by `PrinterInfoCard` (Task 7).

- [ ] **Step 1: Update `AppSwitch.tsx`**

```tsx
// src/components/AppSwitch.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Switch } from 'react-native-paper';

export interface AppSwitchProps {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}

export const AppSwitch: React.FC<AppSwitchProps> = ({ label, value, onValueChange, disabled = false }) => (
  <View style={styles.row}>
    <Text style={styles.label}>{label}</Text>
    <Switch value={value} onValueChange={onValueChange} disabled={disabled} />
  </View>
);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 13, flex: 1 },
});
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/AppSwitch.tsx
git commit -m "feat: add disabled prop to AppSwitch"
```

---

### Task 4: `DeviceScanList` — 30-second scan timeout

**Files:**
- Modify: `src/features/printer/components/DeviceScanList.tsx`

**Interfaces:**
- Consumes: nothing new (still `PrinterService.scanForConnectionType`, unchanged)
- Produces: same public props as before — no interface change, purely internal timeout behavior.

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

const SCAN_TIMEOUT_MS = 30000;

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
    setDevices([]);
    let settled = false;
    const unsubscribe = PrinterService.scanForConnectionType(connectionType, (event) => {
      if (settled) return;
      if (event.type === 'loading') setLoading(true);
      if (event.type === 'found' || event.type === 'empty') {
        settled = true;
        setLoading(false);
        setDevices(event.devices ?? []);
      }
      if (event.type === 'error') {
        settled = true;
        setLoading(false);
        setErrorMessage(event.error?.message ?? 'Không thể quét thiết bị');
      }
    });
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      unsubscribe();
      setLoading(false);
    }, SCAN_TIMEOUT_MS);
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
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

`settled` (a plain closure variable, not state) prevents both a late scan event firing after the timeout already resolved to empty, and the timeout firing after a real event already settled things — only the first of the two ever acts. `setDevices([])` was added at the top of the effect so switching `connectionType` (or pressing refresh) doesn't show a stale device list from the previous scan while the new one is loading.

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/printer/components/DeviceScanList.tsx
git commit -m "feat: stop device scan after 30s and show empty state"
```

---

### Task 5: `StatusPanel` — new component

**Files:**
- Create: `src/features/printer/components/StatusPanel.tsx`

**Interfaces:**
- Consumes: `LoadingOverlay` (existing), `Protocol`/`PrinterDeviceInfo` (existing `printer.types.ts`), `AppError` (existing)
- Produces: `ConnectionState`, `ProtocolState`, `StatusPanel` — `ConnectionState`/`ProtocolState` are imported by `AddPrinterModal` (Task 8) as the canonical definition of these two types.

- [ ] **Step 1: Write `StatusPanel.tsx`**

```tsx
// src/features/printer/components/StatusPanel.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, SegmentedButtons } from 'react-native-paper';
import { LoadingOverlay } from '../../../components/LoadingOverlay';
import type { PrinterDeviceInfo, Protocol } from '../types/printer.types';

export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error';
export type ProtocolState = 'idle' | 'detecting' | 'identified' | 'unknown';

export interface StatusPanelProps {
  connectionState: ConnectionState;
  protocolState: ProtocolState;
  protocol?: Protocol;
  deviceInfo?: PrinterDeviceInfo;
  errorMessage?: string;
  onChooseProtocol: (protocol: Protocol) => void;
}

const protocolLabel: Record<Protocol, string> = {
  escpos: 'ESC/POS',
  tspl: 'TSPL',
};

const protocolChoices: Array<{ value: Protocol; label: string }> = [
  { value: 'escpos', label: 'ESC/POS' },
  { value: 'tspl', label: 'TSPL' },
];

export const StatusPanel: React.FC<StatusPanelProps> = ({
  connectionState,
  protocolState,
  protocol,
  deviceInfo,
  errorMessage,
  onChooseProtocol,
}) => {
  if (protocolState === 'unknown') {
    return (
      <View style={styles.container}>
        <Text variant="bodyMedium">Không thể tự nhận diện giao thức. Vui lòng chọn thủ công:</Text>
        <SegmentedButtons
          value=""
          onValueChange={(value) => onChooseProtocol(value as Protocol)}
          buttons={protocolChoices}
        />
      </View>
    );
  }

  if (connectionState === 'error') {
    return (
      <View style={styles.container}>
        <Text variant="bodyMedium" style={styles.errorText}>
          {errorMessage ?? 'Kết nối thất bại.'}
        </Text>
      </View>
    );
  }

  if (connectionState === 'connecting' && protocolState === 'detecting') {
    return (
      <View style={styles.container}>
        <LoadingOverlay />
        <Text variant="bodyMedium">Đang nhận diện giao thức...</Text>
      </View>
    );
  }

  if (connectionState === 'connecting') {
    return (
      <View style={styles.container}>
        <LoadingOverlay />
        <Text variant="bodyMedium">Đang kết nối...</Text>
      </View>
    );
  }

  if (connectionState === 'connected' && protocolState === 'identified') {
    return (
      <View style={styles.container}>
        <Text variant="bodyMedium" style={styles.successText}>
          ✓ Đã kết nối
        </Text>
        {deviceInfo?.vendor ? <Text variant="bodySmall">Hãng sản xuất: {deviceInfo.vendor}</Text> : null}
        {deviceInfo?.model ? <Text variant="bodySmall">Model: {deviceInfo.model}</Text> : null}
        {protocol ? <Text variant="bodySmall">Giao thức: {protocolLabel[protocol]}</Text> : null}
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  container: { gap: 8 },
  errorText: { color: '#B91C1C' },
  successText: { color: '#15803D' },
});
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no new errors (file is new and self-contained).

- [ ] **Step 3: Commit**

```bash
git add src/features/printer/components/StatusPanel.tsx
git commit -m "feat: add StatusPanel component for connect/identify status"
```

---

### Task 6: `ConnectionSection` — new component

**Files:**
- Create: `src/features/printer/components/ConnectionSection.tsx`

**Interfaces:**
- Consumes: `AppInput` (Task 1), `AppButton` (existing), `DeviceScanList` (Task 4), `ConnectionType`/`PrinterDevice` (existing `printer.types.ts`)
- Produces: `ConnectionSection` — consumed by `AddPrinterModal` (Task 8). Purely presentational/controlled — all state and reset-on-change logic lives in the parent.

- [ ] **Step 1: Write `ConnectionSection.tsx`**

```tsx
// src/features/printer/components/ConnectionSection.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SegmentedButtons } from 'react-native-paper';
import { AppInput } from '../../../components/AppInput';
import { AppButton } from '../../../components/AppButton';
import { DeviceScanList } from './DeviceScanList';
import type { ConnectionType, PrinterDevice } from '../types/printer.types';

export interface ConnectionSectionProps {
  connectionType: ConnectionType;
  onConnectionTypeChange: (value: ConnectionType) => void;
  selectedDeviceId?: string;
  onSelectDevice: (device: PrinterDevice) => void;
  lanIp: string;
  lanPort: string;
  onLanIpChange: (value: string) => void;
  onLanPortChange: (value: string) => void;
  lanIpError?: string;
  lanPortError?: string;
  connectLabel: string;
  connectDisabled: boolean;
  onConnectPress: () => void;
}

export const ConnectionSection: React.FC<ConnectionSectionProps> = ({
  connectionType,
  onConnectionTypeChange,
  selectedDeviceId,
  onSelectDevice,
  lanIp,
  lanPort,
  onLanIpChange,
  onLanPortChange,
  lanIpError,
  lanPortError,
  connectLabel,
  connectDisabled,
  onConnectPress,
}) => (
  <View style={styles.container}>
    <SegmentedButtons
      value={connectionType}
      onValueChange={(value) => onConnectionTypeChange(value as ConnectionType)}
      buttons={[
        { value: 'usb', label: 'USB' },
        { value: 'bluetooth', label: 'Bluetooth' },
        { value: 'lan', label: 'LAN' },
      ]}
    />
    {connectionType === 'lan' ? (
      <>
        <AppInput label="Địa chỉ IP" value={lanIp} onChangeText={onLanIpChange} errorMessage={lanIpError} />
        <AppInput
          label="Cổng"
          value={lanPort}
          onChangeText={onLanPortChange}
          keyboardType="numeric"
          errorMessage={lanPortError}
        />
      </>
    ) : (
      <DeviceScanList connectionType={connectionType} selectedDeviceId={selectedDeviceId} onSelect={onSelectDevice} />
    )}
    <AppButton label={connectLabel} onPress={onConnectPress} disabled={connectDisabled} />
  </View>
);

const styles = StyleSheet.create({
  container: { gap: 12 },
});
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/printer/components/ConnectionSection.tsx
git commit -m "feat: add ConnectionSection component"
```

---

### Task 7: `PrinterInfoCard` — add `locked`, make `protocol`/`protocolSource` optional

**Files:**
- Modify: `src/features/printer/components/PrinterInfoCard.tsx`

**Interfaces:**
- Consumes: `disabled` prop on `AppInput`/`AppSelect`/`AppSwitch` (Tasks 1–3)
- Produces: updated `PrinterInfoCardProps` (`protocol`/`protocolSource` now optional, new `locked: boolean`) — consumed by `AddPrinterModal` (Task 8).

- [ ] **Step 1: Rewrite `PrinterInfoCard.tsx`**

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
  protocol?: Protocol;
  protocolSource?: ProtocolSource;
  deviceInfo?: PrinterDeviceInfo;
  status: PrinterStatus;
  autoReconnect: boolean;
  onAutoReconnectChange: (value: boolean) => void;
  canTestPrint: boolean;
  testPrintPending: boolean;
  onTestPrint: () => void;
  onSave: () => void;
  saveDisabled: boolean;
  locked: boolean;
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
  locked,
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
          disabled={locked}
        />
      )}
    />

    {deviceInfo?.deviceName ? <Text variant="bodySmall">Tên thiết bị: {deviceInfo.deviceName}</Text> : null}
    {deviceInfo?.vendor ? <Text variant="bodySmall">Hãng sản xuất: {deviceInfo.vendor}</Text> : null}
    {deviceInfo?.model ? <Text variant="bodySmall">Model: {deviceInfo.model}</Text> : null}
    <Text variant="bodySmall">Loại kết nối: {connectionLabel[connectionType]}</Text>

    <View style={styles.row}>
      {protocol ? <Chip>{`Giao thức: ${protocolLabel[protocol]}`}</Chip> : null}
      {protocolSource ? <Chip>{protocolSource === 'auto' ? 'Tự động nhận diện' : 'Người dùng chọn'}</Chip> : null}
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
          disabled={locked}
        />
      )}
    />

    <AppSwitch label="Tự động kết nối lại" value={autoReconnect} onValueChange={onAutoReconnectChange} disabled={locked} />

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

Note: "In thử"/"Lưu máy in" gating is untouched (still reads `status`/`saveDisabled`/`canTestPrint` exactly as before) — `locked` only adds `disabled={locked}` to the three editable fields above them, per spec §8.

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: errors only in `AddPrinterModal.tsx` (still passes the old `WizardStep`-based props — fixed in Task 8). `PrinterInfoCard.tsx` itself compiles clean.

- [ ] **Step 3: Commit**

```bash
git add src/features/printer/components/PrinterInfoCard.tsx
git commit -m "feat: add locked prop to PrinterInfoCard, make protocol/protocolSource optional"
```

---

### Task 8: `AddPrinterModal` — single-screen rewrite

**Files:**
- Modify: `src/features/printer/components/AddPrinterModal.tsx`

**Interfaces:**
- Consumes: `ConnectionState`/`ProtocolState`/`StatusPanel` (Task 5), `ConnectionSection` (Task 6), updated `PrinterInfoCard` (Task 7), `PrinterService.{discoverProtocol, connectDraft, disconnectForProtocol, getStatusForProtocol, onStatusChangeForProtocol, testPrint, addPrinter, updatePrinter, connect}` (existing, unchanged), `lanConnectionSchema`/`printerDisplaySchema` (existing, unchanged)
- Produces: `AddPrinterModal` with the same public props as before (`{ visible, initialValues, onDismiss, onSaved }`) — the call site in `PrinterManagementPanel.tsx` does not need to change.

- [ ] **Step 1: Replace `AddPrinterModal.tsx`**

```tsx
// src/features/printer/components/AddPrinterModal.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Modal, Portal, Text } from 'react-native-paper';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PrinterService } from '../services/PrinterService';
import { generateId } from '../../../utils/id';
import {
  lanConnectionSchema,
  printerDisplaySchema,
  type LanConnectionValues,
  type PrinterDisplayValues,
} from '../schemas/printerFormSchema';
import { ConnectionSection } from './ConnectionSection';
import { StatusPanel, type ConnectionState, type ProtocolState } from './StatusPanel';
import { PrinterInfoCard } from './PrinterInfoCard';
import type { DiscoveryEvent } from '../services/discoverProtocol';
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

export const AddPrinterModal: React.FC<AddPrinterModalProps> = ({ visible, initialValues, onDismiss, onSaved }) => {
  const printerId = useMemo(() => initialValues?.id ?? generateId(), [initialValues?.id]);
  const [connectionType, setConnectionType] = useState<ConnectionType>(initialValues?.connectionType ?? 'usb');
  const [selectedDevice, setSelectedDevice] = useState<PrinterDevice | undefined>(initialValues?.device);
  const [autoReconnect, setAutoReconnect] = useState(initialValues?.autoReconnect ?? true);
  const [canTestPrint, setCanTestPrint] = useState(Boolean(initialValues));
  const [testPrintPending, setTestPrintPending] = useState(false);
  const [liveStatus, setLiveStatus] = useState<PrinterStatus>('idle');
  const [connectionDirty, setConnectionDirty] = useState(!initialValues);

  const [connectionState, setConnectionState] = useState<ConnectionState>(initialValues ? 'connected' : 'idle');
  const [protocolState, setProtocolState] = useState<ProtocolState>(initialValues ? 'identified' : 'idle');
  const [protocol, setProtocol] = useState<Protocol | undefined>(initialValues?.protocol);
  const [protocolSource, setProtocolSource] = useState<ProtocolSource | undefined>(initialValues?.protocolSource);
  const [deviceInfo, setDeviceInfo] = useState<PrinterDeviceInfo | undefined>(initialValues?.deviceInfo);
  const [connectionErrorMessage, setConnectionErrorMessage] = useState<string | undefined>(undefined);

  const discoveryUnsubscribeRef = useRef<(() => void) | null>(null);
  const savedRef = useRef(false);
  // Đọc connectionState/protocol "mới nhất" trong effect huỷ-khi-đóng-modal mà
  // KHÔNG đưa chúng vào dependency array của effect đó — bài học từ plan trước
  // (xem Global Constraints): nếu để connectionState/protocol trong deps, React
  // sẽ chạy lại cleanup của effect (vốn huỷ luôn discovery đang chạy) ngay tại
  // thời điểm startDiscovery() vừa gán xong Unsubscribe mới, tự huỷ chính nó.
  const connectionRef = useRef<{ connectionState: ConnectionState; protocol?: Protocol }>({
    connectionState: initialValues ? 'connected' : 'idle',
    protocol: initialValues?.protocol,
  });

  const [step, setStepForRender] = useState(0); // no-op state removed below — placeholder line intentionally absent

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
    connectionRef.current = { connectionState, protocol };
  }, [connectionState, protocol]);

  useEffect(() => {
    if (protocolState !== 'identified' || !protocol) {
      setLiveStatus('idle');
      return undefined;
    }
    setLiveStatus(PrinterService.getStatusForProtocol(protocol, printerId));
    return PrinterService.onStatusChangeForProtocol(protocol, printerId, setLiveStatus);
  }, [protocolState, protocol, printerId]);

  useEffect(() => {
    if (!visible) {
      discoveryUnsubscribeRef.current?.();
      discoveryUnsubscribeRef.current = null;
      const current = connectionRef.current;
      if (current.connectionState === 'connected' && current.protocol && !savedRef.current) {
        PrinterService.disconnectForProtocol(current.protocol, printerId).catch(() => undefined);
      }
    }
    return () => {
      discoveryUnsubscribeRef.current?.();
    };
  }, [visible, printerId]);

  const buildLan = (values: LanConnectionValues) => ({ ip: values.lanIp, port: Number(values.lanPort) });

  const resetConnectionResult = (): void => {
    discoveryUnsubscribeRef.current?.();
    discoveryUnsubscribeRef.current = null;
    setConnectionState('idle');
    setProtocolState('idle');
    setProtocol(undefined);
    setProtocolSource(undefined);
    setDeviceInfo(undefined);
    setConnectionErrorMessage(undefined);
    setCanTestPrint(false);
    setConnectionDirty(true);
  };

  const startDiscovery = (lan?: { ip: string; port: number }): void => {
    setCanTestPrint(false);
    setConnectionDirty(true);
    setConnectionState('connecting');
    setProtocolState('idle');
    setProtocol(undefined);
    setProtocolSource(undefined);
    setDeviceInfo(undefined);
    setConnectionErrorMessage(undefined);
    discoveryUnsubscribeRef.current = PrinterService.discoverProtocol(
      {
        printerId,
        connectionType,
        device: connectionType === 'lan' ? undefined : selectedDevice,
        lan,
      },
      (event: DiscoveryEvent) => {
        if (event.stage === 'identifying') {
          setProtocolState('detecting');
        } else if (event.stage === 'identified' && event.protocol) {
          setConnectionState('connected');
          setProtocolState('identified');
          setProtocol(event.protocol);
          setProtocolSource('auto');
          setDeviceInfo(event.deviceInfo);
          if (!displayForm.getValues('printerName')) {
            displayForm.setValue(
              'printerName',
              event.deviceInfo?.deviceName ?? selectedDevice?.displayName ?? 'Máy in mới',
            );
          }
        } else if (event.stage === 'unknown_protocol') {
          setConnectionState('idle');
          setProtocolState('unknown');
        } else if (event.stage === 'error') {
          setConnectionState('error');
          setProtocolState('idle');
          setConnectionErrorMessage(event.error?.message);
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

  const onChooseProtocol = (chosenProtocol: Protocol): void => {
    setConnectionState('connecting');
    const config: PrinterConfig = {
      id: printerId,
      printerName: 'Máy in mới',
      protocol: chosenProtocol,
      protocolSource: 'manual',
      connectionType,
      paperSize: '80mm',
      autoReconnect: false,
      isDefault: false,
      device: connectionType === 'lan' ? undefined : selectedDevice,
      lan: connectionType === 'lan' ? buildLan(lanForm.getValues()) : undefined,
    };
    PrinterService.connectDraft(config)
      .then(() => {
        setConnectionState('connected');
        setProtocolState('identified');
        setProtocol(chosenProtocol);
        setProtocolSource('manual');
        setDeviceInfo(undefined);
      })
      .catch((error: { message: string }) => {
        setConnectionState('error');
        setProtocolState('idle');
        setConnectionErrorMessage(error.message);
      });
  };

  const onConnectionTypeChange = (value: ConnectionType): void => {
    setConnectionType(value);
    setSelectedDevice(undefined);
    if (connectionState !== 'idle') resetConnectionResult();
  };

  const onSelectDevice = (device: PrinterDevice): void => {
    setSelectedDevice(device);
    if (connectionState !== 'idle') resetConnectionResult();
  };

  const onLanIpChange = (text: string): void => {
    lanForm.setValue('lanIp', text);
    if (connectionState !== 'idle') resetConnectionResult();
  };

  const onLanPortChange = (text: string): void => {
    lanForm.setValue('lanPort', text);
    if (connectionState !== 'idle') resetConnectionResult();
  };

  const buildFinalConfig = (): PrinterConfig | undefined => {
    if (!protocol || !protocolSource) return undefined;
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
    const config = buildFinalConfig();
    if (!config) return;
    const valid = await displayForm.trigger();
    if (!valid) return;
    setTestPrintPending(true);
    try {
      await PrinterService.testPrint(config);
      setCanTestPrint(true);
    } catch {
      setCanTestPrint(false);
    } finally {
      setTestPrintPending(false);
    }
  };

  const onSave = displayForm.handleSubmit(() => {
    const config = buildFinalConfig();
    if (!config || !canTestPrint) return;
    savedRef.current = true;
    if (initialValues) PrinterService.updatePrinter(config);
    else PrinterService.addPrinter(config);
    if (config.autoReconnect && liveStatus !== 'connected') {
      PrinterService.connect(config.id).catch(() => undefined);
    }
    onSaved();
  });

  const connectLabel =
    connectionState === 'connecting' ? 'Đang kết nối...' : connectionState === 'connected' ? 'Kết nối lại' : 'Kết nối';
  const connectDisabled = connectionState === 'connecting' || (connectionType !== 'lan' && !selectedDevice);

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text variant="titleMedium">{initialValues ? 'Chỉnh sửa máy in' : 'Thêm máy in'}</Text>

          <ConnectionSection
            connectionType={connectionType}
            onConnectionTypeChange={onConnectionTypeChange}
            selectedDeviceId={selectedDevice?.deviceId}
            onSelectDevice={onSelectDevice}
            lanIp={lanForm.watch('lanIp')}
            lanPort={lanForm.watch('lanPort')}
            onLanIpChange={onLanIpChange}
            onLanPortChange={onLanPortChange}
            lanIpError={lanForm.formState.errors.lanIp?.message}
            lanPortError={lanForm.formState.errors.lanPort?.message}
            connectLabel={connectLabel}
            connectDisabled={connectDisabled}
            onConnectPress={onConnectPress}
          />

          <StatusPanel
            connectionState={connectionState}
            protocolState={protocolState}
            protocol={protocol}
            deviceInfo={deviceInfo}
            errorMessage={connectionErrorMessage}
            onChooseProtocol={onChooseProtocol}
          />

          <PrinterInfoCard
            control={displayForm.control}
            errors={displayForm.formState.errors}
            connectionType={connectionType}
            protocol={protocol}
            protocolSource={protocolSource}
            deviceInfo={deviceInfo}
            status={liveStatus}
            autoReconnect={autoReconnect}
            onAutoReconnectChange={setAutoReconnect}
            canTestPrint={canTestPrint}
            testPrintPending={testPrintPending}
            onTestPrint={onTestPrint}
            onSave={onSave}
            saveDisabled={connectionDirty && liveStatus !== 'connected'}
            locked={!(connectionState === 'connected' && protocolState === 'identified')}
          />
        </ScrollView>
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  container: { backgroundColor: 'white', margin: 24, padding: 16, borderRadius: 16, maxHeight: '85%' },
  scrollContent: { gap: 12 },
});
```

**Important — remove the placeholder line before running anything.** The line `const [step, setStepForRender] = useState(0); // no-op state removed below — placeholder line intentionally absent` in the Step 1 code block above is not real code — delete that entire line when writing the file. It exists only so this plan's diff-reviewer has an obvious marker if it survives a careless copy-paste; the finished file must not import or use `useState(0)` for anything called `step`.

- [ ] **Step 2: Delete the placeholder line**

Confirm the line mentioned in Step 1 is not present in the file you just wrote. Search the file for the literal string `setStepForRender` — it must have zero matches.

```bash
grep -n "setStepForRender" src/features/printer/components/AddPrinterModal.tsx
```

Expected: no output (no matches). If there is output, delete that line and re-run this check.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: zero errors anywhere in `src/`.

- [ ] **Step 4: Lint**

```bash
npm run lint
```

Expected: no errors. Fix any `react-hooks/exhaustive-deps` warnings this file introduces before moving on — do not suppress with blanket `eslint-disable` comments. If `exhaustive-deps` flags the dismiss-cleanup effect (`[visible, printerId]`) for not including `connectionState`/`protocol`, that warning is expected and intentional per the Global Constraints note — add a targeted inline comment explaining why (referencing `connectionRef`), not a blanket disable.

- [ ] **Step 5: Commit**

```bash
git add src/features/printer/components/AddPrinterModal.tsx
git commit -m "feat: rewrite AddPrinterModal as a single scrollable modal"
```

---

### Task 9: Full Verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full automated suite**

```bash
npx tsc --noEmit
npm run lint
npx jest --watchAll=false
```

Expected: type-check clean, lint clean, all pre-existing test suites still pass unchanged (this plan touches zero files with test coverage — `discoverProtocol.test.ts`, `PrinterService.test.ts`, driver tests, schema tests must show identical pass counts to before this plan).

- [ ] **Step 2: Confirm no `WizardStep` references remain**

```bash
grep -rn "WizardStep\|Đổi kết nối\|Thử lại" src/features/printer/components/AddPrinterModal.tsx
```

Expected: no output. (`"Thử lại"` was the old error-step retry button label, now removed per spec §6; `"Đổi kết nối"` was the old change-connection button, now removed per spec §7.)

- [ ] **Step 3: Manual verification (requires Android SDK/emulator or device + real printer)**

Walk through, on the running app: Settings → "Quản lý máy in" → "Thêm máy in" — confirm the modal shows Connection Section + (empty) Status Panel + a visibly disabled/greyed `PrinterInfoCard` all at once, no screen transition. Pick LAN, enter a real printer's IP/Port, tap "Kết nối" — confirm the Status Panel (and only the Status Panel) updates through connecting → detecting → either the identified summary or the manual-protocol picker, while Connection Section and the (now unlocked) `PrinterInfoCard` stay in place. Confirm changing the IP after a successful connect immediately re-locks `PrinterInfoCard` and clears the Status Panel back to idle. Run "In thử" then "Lưu máy in". **This step needs a real Android device/emulator and a physical printer — if unavailable, tell the user explicitly this step was not run and ask them to verify**, per the spec's testing section.

- [ ] **Step 4: Commit (only if Step 3 uncovered fixes)**

If manual testing required code changes, commit them as a follow-up fix with a clear message. Otherwise this task produces no commit — Task 8's commit is the last one.

---

## Self-Review Notes

- **Spec coverage:** §2 scope (no WizardStep, layout, state split, reset rule, `locked` prop, scan timeout) → Tasks 1–8; §3 layout → Task 8's JSX; §4 state model + transition rules → Task 8 (`ConnectionState`/`ProtocolState` handling in `startDiscovery`/`onChooseProtocol`); §5 Status Panel table → Task 5; §6 Connect button 4 labels → Task 8's `connectLabel`; §7 reset rule (including "don't reset display fields", including cancelling in-flight discovery) → Task 8's `resetConnectionResult`; §8 `PrinterInfoCard.locked` + Disable-not-Hide → Task 7 + Task 8 (component always rendered, never `{condition && <PrinterInfoCard />}`); §9 disabled prop check → Tasks 1–3; §10 scan timeout → Task 4; §11 testing convention → Global Constraints + no test files added; §13 Acceptance Criteria → Task 9 Step 2's grep + manual walkthrough in Step 3.
- **Placeholder scan:** the one `setStepForRender` placeholder line is explicit, self-flagging scaffolding meant to be deleted (Task 8 Steps 1–2 exist specifically to catch it), not a "fill in later" gap — every other step has real, complete code.
- **Type consistency:** `ConnectionState`/`ProtocolState` defined once in `StatusPanel.tsx` (Task 5) and imported unchanged by `AddPrinterModal.tsx` (Task 8); `PrinterInfoCardProps.locked`/optional `protocol`/`protocolSource` (Task 7) match exactly how `AddPrinterModal` passes them (Task 8); `ConnectionSectionProps` (Task 6) match exactly how `AddPrinterModal` calls it (Task 8) — verified no renamed fields.
- **Out-of-scope files confirmed untouched:** `discoverProtocol.ts`, `PrinterService.ts`, `TsplDriver.ts`, `EscPosDriver.ts`, `printerFormSchema.ts`, `PrinterManagementPanel.tsx` do not appear in any task's file list — `AddPrinterModal`'s external props are unchanged so `PrinterManagementPanel.tsx`'s call site needs no edit.
