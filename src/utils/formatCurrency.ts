// src/utils/formatCurrency.ts
export const formatCurrency = (amount: number): string => `${Math.round(amount).toLocaleString('vi-VN')}đ`;
