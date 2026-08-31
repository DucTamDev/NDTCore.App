import NetInfo from '@react-native-community/netinfo';
import { getCurrentWifiIp } from '../NetworkInfoService';

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(),
}));

describe('getCurrentWifiIp', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns the IP when connected to WiFi with a valid address', async () => {
    (NetInfo.fetch as jest.Mock).mockResolvedValue({
      type: 'wifi',
      isConnected: true,
      details: { ipAddress: '192.168.1.23' },
    });
    const result = await getCurrentWifiIp();
    expect(result).toBe('192.168.1.23');
  });

  it('returns null when not connected to WiFi (e.g. cellular)', async () => {
    (NetInfo.fetch as jest.Mock).mockResolvedValue({
      type: 'cellular',
      isConnected: true,
      details: {},
    });
    const result = await getCurrentWifiIp();
    expect(result).toBeNull();
  });

  it('returns null when WiFi type but not connected', async () => {
    (NetInfo.fetch as jest.Mock).mockResolvedValue({
      type: 'wifi',
      isConnected: false,
      details: { ipAddress: '192.168.1.23' },
    });
    const result = await getCurrentWifiIp();
    expect(result).toBeNull();
  });

  it('returns null when WiFi connected but ipAddress missing or unspecified', async () => {
    (NetInfo.fetch as jest.Mock).mockResolvedValue({
      type: 'wifi',
      isConnected: true,
      details: { ipAddress: '0.0.0.0' },
    });
    const result = await getCurrentWifiIp();
    expect(result).toBeNull();
  });
});
