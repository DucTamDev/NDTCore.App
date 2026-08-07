import Config from 'react-native-config';

export const appConfig = {
  apiBaseUrl: Config.API_BASE_URL as string,
  tenantId: Config.TENANT_ID as string,
};
