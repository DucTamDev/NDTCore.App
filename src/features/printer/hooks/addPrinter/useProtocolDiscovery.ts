import { useState, type MutableRefObject } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { DeviceScanService } from '../../services/DeviceScanService';
import { PrinterConnectionService } from '../../services/PrinterConnectionService';
import { getDriverDefinition } from '../../drivers/driverDefinitions';
import type { ConnectionState, ProtocolState } from '../../components/StatusPanel';
import { DiscoveryStage, type DiscoveryEvent } from '../../services/discovery/PrinterDiscoveryService';
import { ConnectionType, DriverSource, PrinterDriverType } from '../../types/printer.types';
import type { Printer, PrinterDeviceInfo, PrinterDriver } from '../../types/printer.types';
import type { LanConnectionValues } from '../../schemas/printerFormSchema';

/**
 * Input cho {@link useProtocolDiscovery}. Callback (`buildDraftPrinter`,
 * `addDriverToList`, `refreshUsbSerial`, `prefillDisplayName`) do coordinator /
 * {@link useConnectionSetup} sở hữu — hook này chỉ điều phối state machine dò
 * protocol.
 */
export interface UseProtocolDiscoveryInput {
  initialValues?: Printer;
  drivers: PrinterDriver[];
  connectionType: ConnectionType;
  lanForm: UseFormReturn<LanConnectionValues>;
  discoveryUnsubscribeRef: MutableRefObject<(() => void) | null>;
  buildDraftPrinter: () => Printer;
  addDriverToList: (type: PrinterDriverType, source: DriverSource) => void;
  refreshUsbSerial: () => Promise<void>;
  prefillDisplayName: (deviceName?: string) => void;
}

/**
 * State machine kết nối + dò protocol của luồng Thêm/Sửa máy in: bấm "Kết nối"
 * → `DeviceScanService.discoverDriver`, xử lý các `DiscoveryEvent`, và nhánh
 * chọn "Printer Language" thủ công qua `PrinterConnectionService.connectDraft`.
 */
export const useProtocolDiscovery = ({
  initialValues,
  drivers,
  connectionType,
  lanForm,
  discoveryUnsubscribeRef,
  buildDraftPrinter,
  addDriverToList,
  refreshUsbSerial,
  prefillDisplayName,
}: UseProtocolDiscoveryInput) => {
  const [connectionDirty, setConnectionDirty] = useState(!initialValues);
  const [connectionState, setConnectionState] = useState<ConnectionState>(initialValues ? 'connected' : 'idle');
  const [protocolState, setProtocolState] = useState<ProtocolState>(initialValues ? 'identified' : 'idle');
  const [lastProtocol, setLastProtocol] = useState<PrinterDriverType | undefined>(initialValues?.drivers[0]?.type);
  const [deviceInfo, setDeviceInfo] = useState<PrinterDeviceInfo | undefined>(undefined);
  const [connectionErrorMessage, setConnectionErrorMessage] = useState<string | undefined>(undefined);

  const resetDiscoveryFields = (nextConnectionState: ConnectionState): void => {
    setConnectionState(nextConnectionState);
    setProtocolState('idle');
    setDeviceInfo(undefined);
    setConnectionErrorMessage(undefined);
    // Chỉ khoá Save khi ĐÂY LÀ driver đầu tiên (chưa có driver nào saveable) —
    // 1 lượt dò driver thứ 2 thất bại không được lùi lại trạng thái saveable
    // đã có từ driver đầu tiên (spec §5.1, coordinator review round 1).
    if (drivers.length === 0) setConnectionDirty(true);
  };

  const resetConnectionResult = (): void => {
    discoveryUnsubscribeRef.current?.();
    discoveryUnsubscribeRef.current = null;
    resetDiscoveryFields('idle');
  };

  const startDiscovery = (): void => {
    resetDiscoveryFields('connecting');
    discoveryUnsubscribeRef.current = DeviceScanService.discoverDriver(
      {
        draftPrinter: buildDraftPrinter(),
        excludedDrivers: drivers.map((d) => d.type),
      },
      (event: DiscoveryEvent) => {
        if (event.stage === DiscoveryStage.identifying) {
          setProtocolState('detecting');
        } else if (event.stage === DiscoveryStage.identified && event.protocol) {
          setConnectionState('connected');
          setProtocolState('identified');
          setLastProtocol(event.protocol);
          setDeviceInfo(event.deviceInfo);
          setConnectionDirty(false);
          addDriverToList(event.protocol, DriverSource.auto);
          refreshUsbSerial();
          prefillDisplayName(event.deviceInfo?.deviceName);
        } else if (event.stage === DiscoveryStage.unknown_protocol) {
          setConnectionState('idle');
          setProtocolState('unknown');
        } else if (event.stage === DiscoveryStage.error) {
          setConnectionState('error');
          setProtocolState('idle');
          setConnectionErrorMessage(event.error?.message);
        }
      },
    );
  };

  const onConnectPress = (): void => {
    if (connectionType === ConnectionType.lan) {
      lanForm.handleSubmit(() => startDiscovery())();
    } else {
      startDiscovery();
    }
  };

  const onChooseProtocol = (chosenProtocol: PrinterDriverType): void => {
    setConnectionState('connecting');
    setProtocolState('detecting');
    const definitionConfig = getDriverDefinition(chosenProtocol).defaultConfig;
    const draftDriver: PrinterDriver = {
      type: chosenProtocol,
      source: DriverSource.manual,
      contentTypes: [],
      config: { ...definitionConfig, media: { ...definitionConfig.media } },
    };
    const base = buildDraftPrinter();
    const draftPrinter: Printer = { ...base, drivers: [...base.drivers, draftDriver] };
    PrinterConnectionService.connectDraft(draftPrinter, draftDriver)
      .then(() => {
        setConnectionState('connected');
        setProtocolState('identified');
        setLastProtocol(chosenProtocol);
        setDeviceInfo(undefined);
        setConnectionDirty(false);
        addDriverToList(chosenProtocol, DriverSource.manual);
        refreshUsbSerial();
        prefillDisplayName();
      })
      .catch((error: { message: string }) => {
        setConnectionState('error');
        setProtocolState('idle');
        setConnectionErrorMessage(error.message);
      });
  };

  return {
    connectionState,
    protocolState,
    lastProtocol,
    deviceInfo,
    connectionErrorMessage,
    connectionDirty,
    resetConnectionResult,
    onConnectPress,
    onChooseProtocol,
  };
};
