// App.tsx
import React, { useEffect } from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { store } from './src/store';
import { theme } from './src/theme/theme';
import { RootNavigator } from './src/navigation/RootNavigator';
import { PrinterService } from './src/features/printer/services/PrinterService';

const queryClient = new QueryClient();

function App(): React.JSX.Element {
  // Trạng thái kết nối máy in chỉ sống trong bộ nhớ JS của driver, không
  // persist — mỗi lần app khởi động lại, mọi máy in đều mất kết nối cho tới
  // khi có bước này (xem PrinterService.reconnectAutoPrinters).
  useEffect(() => {
    PrinterService.reconnectAutoPrinters();
  }, []);

  return (
    <ReduxProvider store={store}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <PaperProvider theme={theme}>
            <RootNavigator />
          </PaperProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </ReduxProvider>
  );
}

export default App;
