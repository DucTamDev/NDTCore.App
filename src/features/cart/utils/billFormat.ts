export const formatDateTime = (iso: string | null): string => {
  if (!iso) return '';
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  Cash: 'Tiền mặt',
  Card: 'Thẻ',
  Transfer: 'Chuyển khoản',
  EWallet: 'Ví điện tử',
};
