import React from 'react';
import { View, StyleSheet } from 'react-native';
import { formatCurrency } from '../../../utils/formatCurrency';
import type { LabelContent, LabelPage } from '../models/templates/LabelContent';
import type { LabelTemplateOptions } from '../models/templates/LabelTemplateOptions';
import { toppingTextOf } from '../models/templates/PrintItem';
import type { PaperOptions } from '../models/paper/PaperOptions';
import { PaperType } from '../models/paper/PaperType';
import { DOTS_PER_MM } from '../models/paper/paperSpec';
import { DEFAULT_LABEL_TEMPLATE } from './TemplateDefaults';
import { PrintText, paddingStyleOf } from './PrintLayout';

/**
 * Ảnh chụp theo pixel vật lý rồi mới thu về dot, làm tròn có thể dư 1 dot; ảnh cao hơn tem bị từ chối in nên chừa
 * trước một ít.
 */
const LABEL_HEIGHT_MARGIN_DOTS = 2;

/** Tem rời cao đúng một con tem, nội dung dài hơn bị cắt; giấy cuộn cao theo nội dung. */
const labelHeightOf = (paper: PaperOptions): number | undefined =>
  paper.type === PaperType.DieCut ? paper.itemHeightMm * DOTS_PER_MM - LABEL_HEIGHT_MARGIN_DOTS : undefined;

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

  /** Giấy của máy in nhận tem, để biết chiều cao con tem. */
  paper: PaperOptions;

  options?: LabelTemplateOptions;
}

/**
 * Một con tem. Thuộc tính và giá chỉ ở tem đầu của ly, ghi chú ở tem cuối; tem tách ra vì nhiều topping ghi
 * "tem p/P" bên phải tên món.
 */
export const LabelTemplate: React.FC<LabelTemplateProps> = (props) => {
  const { content, page, paper, options = DEFAULT_LABEL_TEMPLATE } = props;
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
  const containerStyle = [
    styles.label,
    paddingStyleOf(options.padding),
    { gap: options.lineGap, height: labelHeightOf(paper) },
  ];

  return (
    <View style={containerStyle}>
      {headerParts.length > 0 ? (
        <View style={styles.spread}>
          {headerParts.map((part) => (
            <PrintText key={part} size={fontSize.header} bold>{part}</PrintText>
          ))}
        </View>
      ) : null}
      <View style={styles.spread}>
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
        <View style={[styles.spread, styles.footer]}>
          <PrintText size={fontSize.footer}>{footerLeft}</PrintText>
          <PrintText size={fontSize.footer}>{footerRight}</PrintText>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  label: { overflow: 'hidden' },
  spread: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  name: { flexShrink: 1 },
  part: { flexShrink: 0 },
  footer: { marginTop: 'auto' },
});
