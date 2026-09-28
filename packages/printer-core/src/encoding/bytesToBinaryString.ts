/** Đổi byte thành chuỗi nhị phân 1 ký tự = 1 byte, để byte đi được qua API chỉ nhận chuỗi. */
export function bytesToBinaryString(bytes: Uint8Array): string {
  let binary = '';
  for (let index = 0; index < bytes.length; index++) binary += String.fromCharCode(bytes[index]);
  return binary;
}
