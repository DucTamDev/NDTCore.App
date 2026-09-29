import type { Condition, OptionCondition } from '../content/Condition';
import type { Segment } from '../content/Segment';
import type { TemplateNode } from '../nodes/TemplateNode';
import { optionConditionError, type OptionSetting } from '../settings';
import type { TemplateDocument } from '../TemplateDocument';
import type { TemplateIssue } from './TemplateIssue';

/** Trạng thái 1 lần kiểm tra: settings của template, tên đã dùng, lỗi/cảnh báo gom được. */
interface SettingReferenceCheck {
  readonly template: TemplateDocument;

  readonly usedStyles: Set<string>;

  readonly usedOptions: Set<string>;

  readonly errors: TemplateIssue[];

  readonly warnings: TemplateIssue[];
}

/** Lỗi và cảnh báo của các tham chiếu tới `settings` trong cây node. */
export interface SettingReferenceResult {
  /** Tham chiếu không tồn tại hoặc dùng sai loại option. */
  readonly errors: readonly TemplateIssue[];

  /** Style/option khai báo mà không node nào dùng. */
  readonly warnings: readonly TemplateIssue[];
}

/** Kiểm tra `styleName`, segment và điều kiện `option` trỏ đúng setting khai báo, và đúng loại option. */
export function checkSettingReferences(template: TemplateDocument): SettingReferenceResult {
  const check: SettingReferenceCheck = {
    template,
    usedStyles: new Set(),
    usedOptions: new Set(),
    errors: [],
    warnings: [],
  };
  checkNode(check, template.content, 'content');
  warnUnused(check);
  return { errors: check.errors, warnings: check.warnings };
}

function checkNode(
  check: SettingReferenceCheck,
  node: TemplateNode,
  path: string,
): void {
  if (node.visibleWhen) checkCondition(check, node.visibleWhen, `${path}.visibleWhen`);

  switch (node.type) {
    case 'container':
      node.children.forEach((child, index) => checkNode(check, child, `${path}.children[${index}]`));
      return;
    case 'text':
      if (node.styleName !== undefined) checkStyleName(check, node.styleName, `${path}.styleName`);
      checkSegments(check, node.content, `${path}.content`);
      return;
    case 'barcode':
    case 'qrcode':
      checkSegments(check, node.content, `${path}.content`);
      return;
    case 'repeat':
      checkNode(check, node.template, `${path}.template`);
      return;
    case 'image':
    case 'line':
      return;
  }
}

function checkStyleName(
  check: SettingReferenceCheck,
  name: string,
  path: string,
): void {
  check.usedStyles.add(name);
  if (!hasOwn(check.template.settings.styles, name)) {
    check.errors.push({ path, message: `settings không có style "${name}"` });
  }
}

function checkSegments(
  check: SettingReferenceCheck,
  segments: readonly Segment[],
  path: string,
): void {
  segments.forEach((segment, index) => {
    if (!('option' in segment)) return;

    const segmentPath = `${path}[${index}]`;
    const option = findOption(check, segment.option, segmentPath);
    if (option && option.type !== 'text') {
      check.errors.push({ path: segmentPath, message: `option "${segment.option}" không phải kiểu text` });
    }
  });
}

function checkCondition(
  check: SettingReferenceCheck,
  condition: Condition,
  path: string,
): void {
  switch (condition.op) {
    case 'and':
    case 'or':
      condition.conditions.forEach((child, index) => checkCondition(check, child, `${path}.conditions[${index}]`));
      return;
    case 'not':
      checkCondition(check, condition.condition, `${path}.condition`);
      return;
    case 'option':
      checkOptionCondition(check, condition, path);
      return;
    default:
      return;
  }
}

function checkOptionCondition(
  check: SettingReferenceCheck,
  condition: OptionCondition,
  path: string,
): void {
  const option = findOption(check, condition.option, path);
  if (!option) return;

  const message = optionConditionError(option, condition);
  if (message !== undefined) check.errors.push({ path, message });
}

function findOption(
  check: SettingReferenceCheck,
  name: string,
  path: string,
): OptionSetting | undefined {
  check.usedOptions.add(name);
  const options = check.template.settings.options;
  if (hasOwn(options, name)) return options[name];

  check.errors.push({ path, message: `settings không có option "${name}"` });
  return undefined;
}

function warnUnused(check: SettingReferenceCheck): void {
  for (const name of Object.keys(check.template.settings.styles)) {
    if (check.usedStyles.has(name)) continue;
    check.warnings.push({ path: `settings.styles.${name}`, message: `style "${name}" khai báo nhưng không dùng` });
  }
  for (const name of Object.keys(check.template.settings.options)) {
    if (check.usedOptions.has(name)) continue;
    check.warnings.push({ path: `settings.options.${name}`, message: `option "${name}" khai báo nhưng không dùng` });
  }
}

// Tên setting đến từ JSON nên phải tra đúng key riêng, không trúng `toString`... của prototype.
function hasOwn(record: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}
