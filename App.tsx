// App.tsx
import React, { useEffect } from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { store } from './src/store';
import { theme } from './src/theme/theme';
import { RootNavigator } from './src/navigation/RootNavigator';
import { PrintCaptureHost, printerManager } from '@ndtcore/printer';
import { PrintFailureSnackbar } from './src/features/printer/components/PrintFailureSnackbar';
import { LoggerService } from './src/services/LoggerService';

const queryClient = new QueryClient();

/** Ghi log của package máy in qua logger của App; dòng có mã lỗi là cảnh báo. */
function writePrinterLog(line: string): void {
  if (line.includes(' code=')) {
    LoggerService.warning(line);
  } else {
    LoggerService.info(line);
  }
}

function App(): React.JSX.Element {
  // Package không giữ trạng thái kết nối qua lần chạy; mở app thì đọc máy đã lưu và kết nối lại.
  useEffect(() => {
    printerManager.setLogSink(writePrinterLog);
    printerManager.initAsync().catch((error: unknown) => LoggerService.error('Khởi động máy in lỗi', { error }));
  }, []);

  return (
    <ReduxProvider store={store}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <PaperProvider theme={theme}>
            <RootNavigator />
            <PrintFailureSnackbar />
            <PrintCaptureHost />
          </PaperProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </ReduxProvider>
  );
}

export default App;
