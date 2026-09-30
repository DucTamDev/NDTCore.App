import NetInfo from '@react-native-community/netinfo';

/**
 * Lấy IP WiFi hiện tại của thiết bị, dùng để gợi ý subnet khi người dùng
 * nhập IP máy in LAN thủ công. Trả `null` khi không kết nối WiFi hoặc
 * không lấy được địa chỉ hợp lệ — không throw, vì đây chỉ là gợi ý.
 */
export async function getCurrentWifiIp(): Promise<string | null> {
  const state = await NetInfo.fetch();

  if (state.type !== 'wifi' || !state.isConnected) {
    return null;
  }

  const ipAddress = (state.details as { ipAddress?: string } | null)?.ipAddress;

  if (!ipAddress || ipAddress === '0.0.0.0') {
    return null;
  }

  return ipAddress;
}
