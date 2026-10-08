import React from 'react';
import { View } from 'react-native';
import { formatCurrency } from '../../../utils/formatCurrency';
import { PrintDivider, PrintRow, PrintText } from './PrintLayout';

const formatSampleDateTime = (): string =>
  new Date().toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

/** Bill mẫu cho "In thử": dữ liệu cố định, bố cục giống bill thật để người dùng thấy kết quả in. */
export const SampleReceipt: React.FC = () => (
  <View>
    <PrintText>NDTCore Coffee - Chi nhánh Quận 1</PrintText>
    <PrintText>123 Nguyễn Huệ, Quận 1, TP.HCM</PrintText>
    <PrintDivider />
    <PrintRow label="Mã đơn" value="#DEMO001 (In thử)" />
    <PrintRow label="Thời gian" value={formatSampleDateTime()} />
    <PrintRow label="Hình thức" value="Tại quán" />
    <PrintDivider />
    <PrintText>SẢN PHẨM</PrintText>
    <PrintRow label="2x Cà phê sữa đá" value={formatCurrency(2 * 29000)} />
    <PrintText>  Ghi chú: Ít đá</PrintText>
    <PrintRow label="1x Bánh mì thịt" value={formatCurrency(35000)} />
    <PrintRow label="1x Trà đào cam sả" value={formatCurrency(45000)} />
    <PrintDivider />
    <PrintRow label="Tổng số lượng" value="4" />
    <PrintRow label="Tạm tính" value={formatCurrency(138000)} />
    <PrintRow label="Giảm giá" value={`-${formatCurrency(8000)}`} />
    <PrintDivider />
    <PrintRow label="TỔNG THANH TOÁN" value={formatCurrency(130000)} />
    <PrintRow label="Phương thức" value="Tiền mặt" />
    <PrintRow label="Số tiền nhận" value={formatCurrency(150000)} />
    <PrintRow label="Tiền thừa" value={formatCurrency(20000)} />
    <PrintDivider />
    <PrintText>Cảm ơn quý khách! Hẹn gặp lại lần sau</PrintText>
  </View>
);

/** Tem mẫu chỉ có tên món: tem rời thường cao ~30mm, nội dung dài hơn sẽ tràn sang tem kế tiếp. */
export const SampleLabel: React.FC = () => <PrintText>Trà sữa trân châu</PrintText>;
