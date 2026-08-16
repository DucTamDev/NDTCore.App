// src/utils/formatCurrency.ts
export const formatCurrency = (amount: number): string =>
  `${(Number.isFinite(amount) ? Math.round(amount) : 0).toLocaleString('vi-VN')}đ`;
