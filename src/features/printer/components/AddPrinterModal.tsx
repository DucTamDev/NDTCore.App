// src/features/printer/components/AddPrinterModal.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Modal, Portal, Snackbar, Text } from 'react-native-paper';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PrinterService } from '../services/PrinterService';
import { getCurrentWifiIp } from '../services/NetworkInfoService';
import { buildSampleReceiptDocument, buildSampleLabelDocument } from '../utils/sampleDocuments';
import { useBillImageCapture } from '../hooks/useBillImageCapture';
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
import { AppErrorException } from '../types/AppError';
import type { PrintDocument } from '../types/printDocument.types';
import type { PrintType } from '../types/printConfiguration.types';
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
  const [printsReceipt, setPrintsReceipt] = useState(initialValues?.printsReceipt ?? false);
  const [printsLabel, setPrintsLabel] = useState(initialValues?.printsLabel ?? false);
  const [tsplRenderAsImage, setTsplRenderAsImage] = useState(initialValues?.tsplRenderAsImage ?? true);
  const [testPrintReceiptPending, setTestPrintReceiptPending] = useState(false);
  const [testPrintLabelPending, setTestPrintLabelPending] = useState(false);
  const [testPrintErrorMessage, setTestPrintErrorMessage] = useState<string | null>(null);
  const { captureNode, captureBillImage } = useBillImageCapture();
  const [liveStatus, setLiveStatus] = useState<PrinterStatus>('idle');
  const [connectionDirty, setConnectionDirty] = useState(!initialValues);

  const [connectionState, setConnectionState] = useState<ConnectionState>(initialValues ? 'connected' : 'idle');
  const [protocolState, setProtocolState] = useState<ProtocolState>(initialValues ? 'identified' : 'idle');
  const [protocol, setProtocol] = useState<Protocol | undefined>(initialValues?.protocol);
  const [protocolSource, setProtocolSource] = useState<ProtocolSource | undefined>(initialValues?.protocolSource);
  const [deviceInfo, setDeviceInfo] = useState<PrinterDeviceInfo | undefined>(initialValues?.deviceInfo);
  const [connectionErrorMessage, setConnectionErrorMessage] = useState<string | undefined>(undefined);
  const [detectedLanIp, setDetectedLanIp] = useState<string | null>(null);
  const [lanIpFetchError, setLanIpFetchError] = useState<string | undefined>(undefined);

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

  // deps cố ý chỉ gồm [visible, printerId] — connectionState/protocol được đọc
  // "mới nhất" qua connectionRef.current (xem comment ở khai báo connectionRef
  // phía trên). Thêm connectionState/protocol vào đây sẽ khiến React chạy lại
  // cleanup của chính effect này ngay khi startDiscovery() vừa bắt đầu, tự huỷ
  // discovery vừa khởi tạo — đây chính là bug đã xảy ra ở wizard cũ.
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

  // Dùng chung bởi resetConnectionResult (huỷ kết quả, quay về 'idle') và
  // startDiscovery (chuẩn bị bắt đầu 1 lượt dò mới, quay về 'connecting') —
  // 2 nơi reset cùng 1 tập field, chỉ khác giá trị connectionState đích.
  const resetDiscoveryFields = (nextConnectionState: ConnectionState): void => {
    setConnectionState(nextConnectionState);
    setProtocolState('idle');
    setProtocol(undefined);
    setProtocolSource(undefined);
    setDeviceInfo(undefined);
    setConnectionErrorMessage(undefined);
    setConnectionDirty(true);
  };

  const resetConnectionResult = (): void => {
    discoveryUnsubscribeRef.current?.();
    discoveryUnsubscribeRef.current = null;
    resetDiscoveryFields('idle');
  };

  const startDiscovery = (lan?: { ip: string; port: number }): void => {
    resetDiscoveryFields('connecting');
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
    setProtocolState('detecting');
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
    if (connectionState !== 'idle' || protocolState !== 'idle') resetConnectionResult();
  };

  const onSelectDevice = (device: PrinterDevice): void => {
    setSelectedDevice(device);
    if (connectionState !== 'idle' || protocolState !== 'idle') resetConnectionResult();
  };

  const onLanIpChange = (text: string): void => {
    lanForm.setValue('lanIp', text);
    if (connectionState !== 'idle' || protocolState !== 'idle') resetConnectionResult();
  };

  const onLanPortChange = (text: string): void => {
    lanForm.setValue('lanPort', text);
    if (connectionState !== 'idle' || protocolState !== 'idle') resetConnectionResult();
  };

  const onFetchLanIp = async (): Promise<void> => {
    setLanIpFetchError(undefined);
    const ip = await getCurrentWifiIp();
    if (!ip) {
      setDetectedLanIp(null);
      setLanIpFetchError('Không lấy được IP — kiểm tra đã kết nối WiFi chưa');
      return;
    }
    setDetectedLanIp(ip);
  };

  const onAutoFillLanIp = (): void => {
    if (!detectedLanIp) return;
    onLanIpChange(detectedLanIp);
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
      enabled: initialValues?.enabled ?? true,
      printsReceipt,
      printsLabel,
      // Chỉ có ý nghĩa với TSPL (xem `PrinterConfig.tsplRenderAsImage`) — để
      // `undefined` cho ESC/POS thay vì lưu giá trị toggle không dùng tới.
      tsplRenderAsImage: protocol === 'tspl' ? tsplRenderAsImage : undefined,
      device: connectionType === 'lan' ? undefined : selectedDevice,
      lan: connectionType === 'lan' ? buildLan(lanForm.getValues()) : undefined,
      deviceInfo,
    };
  };

  /**
   * Khi bật `tsplRenderAsImage` (chỉ có ý nghĩa với TSPL), gửi thẳng `document`
   * dạng text sẽ đi qua `TsplEncoder.text()` — font built-in `"3"` không có
   * dấu tiếng Việt trên nhiều dòng máy, đồng thời `y` tính theo dot (không
   * phải chiều cao dòng thật của font) nên các dòng dễ đè lên nhau/lệch vị
   * trí. Né cả 2 vấn đề bằng cách chụp lại `document` thành ảnh qua
   * `useBillImageCapture` (cùng cơ chế `OrderPrintTrigger.printReceipt()`
   * dùng cho bill thật) rồi gửi ảnh đó thay vì lệnh `TEXT` — layout/font đều
   * do React Native `Text` đo đạc và render thật, không phụ thuộc font
   * resident của máy in. Tắt `tsplRenderAsImage` (máy TSPL có font Unicode
   * resident sẵn) hoặc ESC/POS (driver không hỗ trợ phần tử `image` —
   * `ThermalReceiptDriver.encodeDocument` ném `ENCODING_FAILED`) vẫn đi text
   * như cũ. Capture thất bại (`null`, vd offscreen View chưa kịp layout) rơi
   * về `document` gốc thay vì chặn "In thử" hẳn — chấp nhận rủi ro lỗi font
   * còn hơn không in được gì.
   */
  const resolveTestPrintDocument = async (config: PrinterConfig, document: PrintDocument): Promise<PrintDocument> => {
    if (config.protocol !== 'tspl' || !config.tsplRenderAsImage) return document;
    const base64 = await captureBillImage(document, config.paperSize);
    if (!base64) return document;
    return { elements: [{ type: 'image', data: base64, x: 0, y: 0 }] };
  };

  /**
   * Dùng chung cho cả 2 nút "In bill thử"/"In tem thử" — mỗi nút truyền vào
   * `document` mẫu riêng (`buildSampleReceiptDocument`/`buildSampleLabelDocument`,
   * cùng cấu trúc `PrintElement` với bill/tem thật, chỉ khác data ví dụ), qua
   * `resolveTestPrintDocument` để đổi sang ảnh nếu là máy TSPL, rồi mới gửi
   * xuống driver. 2 nút tách riêng ở đây chỉ để khớp với toggle
   * `printsReceipt`/`printsLabel` — bấm nhầm nút chưa bật sẽ bị disable.
   */
  const runTestPrint = async (
    setPending: (pending: boolean) => void,
    document: PrintDocument,
    printType: PrintType,
  ): Promise<void> => {
    const config = buildFinalConfig();
    if (!config) return;
    const valid = await displayForm.trigger();
    if (!valid) return;
    setPending(true);
    setTestPrintErrorMessage(null);
    try {
      const printedDocument = await resolveTestPrintDocument(config, document);
      await PrinterService.testPrint(config, printedDocument, printType);
    } catch (error) {
      // Lỗi đã được PrinterLogger ghi lại trong driver (testPrintFailed) —
      // không chặn Save vì "In thử" chỉ là bước xác nhận tuỳ chọn, không bắt
      // buộc để thêm máy in (xem `saveDisabled` — chỉ cần đã kết nối/nhận
      // diện protocol thành công). Vẫn hiện message cho user thấy lý do thất
      // bại (vd nội dung vượt khổ giấy) thay vì chỉ nằm trong log không ai
      // xem — xem `ENCODING_FAILED` ở `TsplDriver.encodeElements()`.
      setTestPrintErrorMessage(error instanceof AppErrorException ? error.message : 'In thử thất bại');
    } finally {
      setPending(false);
    }
  };

  const onTestPrintReceipt = (): Promise<void> =>
    runTestPrint(setTestPrintReceiptPending, buildSampleReceiptDocument(), 'Receipt');
  const onTestPrintLabel = (): Promise<void> => runTestPrint(setTestPrintLabelPending, buildSampleLabelDocument(), 'Label');

  const onSave = displayForm.handleSubmit(() => {
    const config = buildFinalConfig();
    if (!config) return;
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
            detectedLanIp={detectedLanIp}
            lanIpFetchError={lanIpFetchError}
            onFetchLanIp={onFetchLanIp}
            onAutoFillLanIp={onAutoFillLanIp}
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
            printsReceipt={printsReceipt}
            onPrintsReceiptChange={setPrintsReceipt}
            printsLabel={printsLabel}
            onPrintsLabelChange={setPrintsLabel}
            tsplRenderAsImage={tsplRenderAsImage}
            onTsplRenderAsImageChange={setTsplRenderAsImage}
            testPrintReceiptPending={testPrintReceiptPending}
            onTestPrintReceipt={onTestPrintReceipt}
            testPrintLabelPending={testPrintLabelPending}
            onTestPrintLabel={onTestPrintLabel}
            onSave={onSave}
            saveDisabled={connectionDirty && liveStatus !== 'connected'}
            locked={!(connectionState === 'connected' && protocolState === 'identified')}
          />
          {captureNode}
        </ScrollView>
        <Snackbar visible={testPrintErrorMessage !== null} onDismiss={() => setTestPrintErrorMessage(null)} duration={5000}>
          {testPrintErrorMessage}
        </Snackbar>
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  container: { backgroundColor: 'white', margin: 24, padding: 16, borderRadius: 16, maxHeight: '85%' },
  scrollContent: { gap: 12 },
});
