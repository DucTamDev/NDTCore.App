import { useState, type MutableRefObject } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { DeviceScanService } from '../../discovery/DeviceScanService';
import { PrinterConnectionService } from '../../connection/PrinterConnectionService';
import { createPrinterLanguage } from '../../management/createPrinterDraft';
import type { ConnectionState, ProtocolState } from '../../components/StatusPanel';
import { DiscoveryStage, type DiscoveryEvent } from '../../discovery/PrinterDiscoveryService';
import { ConnectionType } from '../../models/printer/ConnectionType';
import { LanguageSelection, type PrinterLanguage, type PrintLanguage } from '../../models/printer/PrinterLanguage';
import type { Printer } from '../../models/printer/Printer';
import type { PrinterDeviceInfo } from '../../models/printer/PrinterDevice';
import type { LanConnectionValues } from '../../forms/addPrinter/LanConnectionSchema';

/**
 * Input cho {@link useProtocolDiscovery}. `buildDraftPrinter`/`setLanguage`/
 * `refreshUsbSerial`/`prefillDisplayName` do coordinator / {@link useConnectionSetup}
 * sở hữu — hook này chỉ điều phối state machine dò protocol.
 */
export interface UseProtocolDiscoveryInput {
  initialValues?: Printer;
  connectionType: ConnectionType;
  lanForm: UseFormReturn<LanConnectionValues>;
  discoveryUnsubscribeRef: MutableRefObject<(() => void) | null>;
  buildDraftPrinter: () => Printer;
  setLanguage: (language: PrinterLanguage) => void;
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
  connectionType,
  lanForm,
  discoveryUnsubscribeRef,
  buildDraftPrinter,
  setLanguage,
  refreshUsbSerial,
  prefillDisplayName,
}: UseProtocolDiscoveryInput) => {
  const [connectionDirty, setConnectionDirty] = useState(!initialValues);
  const [connectionState, setConnectionState] = useState<ConnectionState>(initialValues ? 'connected' : 'idle');
  const [protocolState, setProtocolState] = useState<ProtocolState>(initialValues ? 'identified' : 'idle');
  const [lastProtocol, setLastProtocol] = useState<PrintLanguage | undefined>(initialValues?.language.type);
  const [deviceInfo, setDeviceInfo] = useState<PrinterDeviceInfo | undefined>(undefined);
  const [connectionErrorMessage, setConnectionErrorMessage] = useState<string | undefined>(undefined);

  const resetDiscoveryFields = (nextConnectionState: ConnectionState): void => {
    setConnectionState(nextConnectionState);
    setProtocolState('idle');
    setDeviceInfo(undefined);
    setConnectionErrorMessage(undefined);
    setConnectionDirty(true);
  };

  const resetConnectionResult = (): void => {
    discoveryUnsubscribeRef.current?.();
    discoveryUnsubscribeRef.current = null;
    resetDiscoveryFields('idle');
  };

  const startDiscovery = (): void => {
    resetDiscoveryFields('connecting');
    discoveryUnsubscribeRef.current = DeviceScanService.discoverDriver(
      { draftPrinter: buildDraftPrinter() },
      (event: DiscoveryEvent) => {
        switch (event.stage) {
          case DiscoveryStage.Identifying:
            setProtocolState('detecting');
            break;
          case DiscoveryStage.Identified:
            if (!event.protocol || !event.language) {
              break;
            }

            setConnectionState('connected');
            setProtocolState('identified');
            setLastProtocol(event.protocol);
            setDeviceInfo(event.deviceInfo);
            setConnectionDirty(false);
            setLanguage(event.language);
            refreshUsbSerial();
            prefillDisplayName(event.deviceInfo?.deviceName);
            break;
          case DiscoveryStage.UnknownProtocol:
            setConnectionState('idle');
            setProtocolState('unknown');
            break;
          case DiscoveryStage.Error:
            setConnectionState('error');
            setProtocolState('idle');
            setConnectionErrorMessage(event.error?.message);
            break;
          default:
            break;
        }
      },
    );
  };

  const onConnectPress = (): void => {
    if (connectionType === ConnectionType.Lan) {
      lanForm.handleSubmit(() => startDiscovery())();
    } else {
      startDiscovery();
    }
  };

  const onChooseProtocol = (chosenProtocol: PrintLanguage): void => {
    setConnectionState('connecting');
    setProtocolState('detecting');
    const draftLanguage: PrinterLanguage = createPrinterLanguage(chosenProtocol, LanguageSelection.Manual);
    const draftPrinter: Printer = { ...buildDraftPrinter(), language: draftLanguage };
    PrinterConnectionService.connectDraft(draftPrinter)
      .then(() => {
        setConnectionState('connected');
        setProtocolState('identified');
        setLastProtocol(chosenProtocol);
        setDeviceInfo(undefined);
        setConnectionDirty(false);
        setLanguage(draftLanguage);
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
