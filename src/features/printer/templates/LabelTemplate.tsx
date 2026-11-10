import React from 'react';
import { View, StyleSheet } from 'react-native';
import { usePrintRenderContext } from '@ndtcore/printer';
import { formatCurrency } from '../../../utils/formatCurrency';
import type { LabelContent, LabelPage } from '../models/templates/LabelContent';
import type { LabelTemplateOptions } from '../models/templates/LabelTemplateOptions';
import { toppingTextOf } from '../models/templates/PrintItem';
import { DEFAULT_LABEL_TEMPLATE } from './TemplateDefaults';
import { PrintText, usePaddingStyle } from './PrintLayout';

/** Khoảng giữa hai phần trên cùng một dòng. */
const SPREAD_GAP_DOTS = 8;

/** Dòng trên theo thứ tự mã đơn → hình thức → số thứ tự ly. */
const headerPartsOf = (content: LabelContent, page: LabelPage, options: LabelTemplateOptions): string[] =>
  [
    options.showOrderNumber ? `#${content.orderNumber}` : '',
    options.showServiceType ? (content.serviceType ?? '') : '',
    options.showCupIndex ? `Ly ${page.cupNumber}/${page.cupCount}` : '',
  ].filter(Boolean);

/** Bên trái tên cửa hàng · tên khách, bên phải giờ. */
const footerPartsOf = (content: LabelContent, options: LabelTemplateOptions): [string, string] => {
  const names = [
    options.showStoreName ? content.storeName : null,
    options.showCustomerName ? content.customerName : null,
  ];

  return [names.filter(Boolean).join(' · '), options.showTime ? content.time : ''];
};

/** Thuộc tính của mẫu tem. */
interface LabelTemplateProps {
  content: LabelContent;

  page: LabelPage;

  options?: LabelTemplateOptions;
}

/**
 * Một con tem. Thuộc tính và giá chỉ ở tem đầu của ly, ghi chú ở tem cuối; tem tách ra vì nhiều topping ghi
 * "tem p/P" bên phải tên món.
 */
export const LabelTemplate: React.FC<LabelTemplateProps> = (props) => {
  const { content, page, options = DEFAULT_LABEL_TEMPLATE } = props;
  const { toDp } = usePrintRenderContext();
  const paddingStyle = usePaddingStyle(options.padding);
  const spreadStyle = [styles.spread, { gap: toDp(SPREAD_GAP_DOTS) }];
  const { fontSize } = options;
  const { item } = page;
  const isFirstPart = page.partNumber === 1;
  const isLastPart = page.partNumber === page.partCount;
  const headerParts = headerPartsOf(content, page, options);
  const [footerLeft, footerRight] = footerPartsOf(content, options);
  const showAttributes = isFirstPart && options.showAttributes && item.attributes.length > 0;
  const showNote = isLastPart && options.showItemNote && Boolean(item.note);
  const showPrice = isFirstPart && options.showPrice;
  const showFooter = Boolean(footerLeft || footerRight);
  const partText = page.partCount > 1 ? `tem ${page.partNumber}/${page.partCount}` : null;
  // Khung chụp của package cao đúng một con tem; mẫu lấp đầy khung, nội dung dài hơn bị cắt.
  const containerStyle = [styles.label, paddingStyle, { gap: toDp(options.lineGap) }];

  return (
    <View style={containerStyle}>
      {headerParts.length > 0 ? (
        <View style={spreadStyle}>
          {headerParts.map((part) => (
            <PrintText key={part} size={fontSize.header} bold>{part}</PrintText>
          ))}
        </View>
      ) : null}
      <View style={spreadStyle}>
        <PrintText size={fontSize.itemName} bold style={styles.name}>{item.name}</PrintText>
        {partText ? <PrintText size={fontSize.itemName} style={styles.part}>{partText}</PrintText> : null}
      </View>
      {showAttributes ? <PrintText size={fontSize.attributes}>{item.attributes.join(' · ')}</PrintText> : null}
      {page.toppings.map((topping, index) => (
        <PrintText key={index} size={fontSize.toppings}>{`+ ${toppingTextOf(topping)}`}</PrintText>
      ))}
      {showNote ? <PrintText size={fontSize.note}>{`* ${item.note}`}</PrintText> : null}
      {showPrice ? <PrintText size={fontSize.attributes}>{formatCurrency(item.unitPrice)}</PrintText> : null}
      {showFooter ? (
        <View style={[spreadStyle, styles.footer]}>
          <PrintText size={fontSize.footer}>{footerLeft}</PrintText>
          <PrintText size={fontSize.footer}>{footerRight}</PrintText>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  label: { flex: 1, overflow: 'hidden' },
  spread: { flexDirection: 'row', justifyContent: 'space-between' },
  name: { flexShrink: 1 },
  part: { flexShrink: 0 },
  footer: { marginTop: 'auto' },
});
