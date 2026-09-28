import type { Condition } from '../content/Condition';
import type { Segment } from '../content/Segment';
import type { ValueFormat } from '../content/ValueFormat';
import {
  BUILT_IN_VARIABLE_SCOPES,
  createTemplateDataIndex,
  isBuiltInVariableName,
  type BuiltInVariableName,
  type TemplateDataDescription,
  type TemplateDataIndex,
  type VariableType,
} from '../data';
import type { ImageNode } from '../nodes/ImageNode';
import type { RepeatNode } from '../nodes/RepeatNode';
import type { TemplateNode } from '../nodes/TemplateNode';
import type { TemplateDocument } from '../TemplateDocument';
import type { TemplateIssue } from './TemplateIssue';

/** Kết quả kiểm tra template theo dữ liệu template. */
export interface TemplateDataValidationResult {
  /** Lỗi chặn — template không resolve đúng được. */
  readonly errors: readonly TemplateIssue[];

  /** Cảnh báo không chặn, VD dùng biến `deprecated`. */
  readonly warnings: readonly TemplateIssue[];
}

/** Scope tại 1 vị trí trong cây node. */
interface ValidationScope {
  /** Các collection đang được `repeat`, từ ngoài vào trong. */
  readonly collections: readonly string[];

  /** `repeat` trong cùng có `expand` hay không (quyết định dùng được `$unit`). */
  readonly expanded: boolean;
}

/** Trạng thái 1 lần kiểm tra: bảng tra dữ liệu template + lỗi/cảnh báo gom được. */
interface TemplateDataCheck {
  readonly description: TemplateDataDescription;

  readonly index: TemplateDataIndex;

  readonly errors: TemplateIssue[];

  readonly warnings: TemplateIssue[];
}

/** Kiểu biến tương thích với từng loại format. */
const FORMAT_COMPATIBLE_TYPES: Readonly<Record<ValueFormat['type'], readonly VariableType[]>> = {
  number: ['number', 'money'],
  currency: ['number', 'money'],
  datetime: ['datetime'],
  text: ['string', 'number', 'money', 'datetime', 'boolean'],
};

/** Kiểu của mọi biến có sẵn. */
const BUILT_IN_VARIABLE_TYPE: VariableType = 'number';

const ROOT_SCOPE: ValidationScope = { collections: [], expanded: false };

/**
 * Kiểm tra template khớp dữ liệu template: biến tồn tại và dùng đúng scope, collection/expand hợp lệ, ảnh dùng biến
 * kiểu `asset`, format hợp kiểu biến. Nhận metadata (`describe()`) nên BE/designer dùng chung được.
 */
export function validateTemplateAgainstData(
  template: TemplateDocument,
  description: TemplateDataDescription,
): TemplateDataValidationResult {
  const index = createTemplateDataIndex(description);
  const check: TemplateDataCheck = { description, index, errors: [], warnings: [] };
  if (template.dataId !== description.id) {
    addError(check, 'dataId', `template dùng dữ liệu "${template.dataId}", không phải "${description.id}"`);
  }
  checkNode(check, template.root, 'root', ROOT_SCOPE);
  return { errors: check.errors, warnings: check.warnings };
}

function addError(
  check: TemplateDataCheck,
  path: string,
  message: string,
): void {
  check.errors.push({ path, message });
}

function collectionLabel(check: TemplateDataCheck, collection: string): string {
  return check.index.collections.get(collection)?.description.label ?? collection;
}

function checkNode(
  check: TemplateDataCheck,
  node: TemplateNode,
  path: string,
  scope: ValidationScope,
): void {
  if (node.visibleWhen) checkCondition(check, node.visibleWhen, `${path}.visibleWhen`, scope);

  switch (node.type) {
    case 'container':
      node.children.forEach((child, index) => checkNode(check, child, `${path}.children[${index}]`, scope));
      return;
    case 'text':
    case 'barcode':
    case 'qrcode':
      checkSegments(check, node.content, `${path}.content`, scope);
      return;
    case 'image':
      checkImage(check, node, path, scope);
      return;
    case 'repeat':
      checkRepeat(check, node, path, scope);
      return;
    case 'line':
      return;
  }
}

function checkSegments(
  check: TemplateDataCheck,
  segments: readonly Segment[],
  path: string,
  scope: ValidationScope,
): void {
  segments.forEach((segment, index) => {
    if (!('var' in segment)) return;

    const segmentPath = `${path}[${index}]`;
    const type = checkVariableUse(check, segment.var, segmentPath, scope);
    if (type !== undefined && segment.format) checkFormat(check, segment.format, type, `${segmentPath}.format`);
  });
}

function checkFormat(
  check: TemplateDataCheck,
  format: ValueFormat,
  type: VariableType,
  path: string,
): void {
  if (FORMAT_COMPATIBLE_TYPES[format.type].includes(type)) return;
  addError(check, path, `format "${format.type}" không dùng được cho biến kiểu "${type}"`);
}

function checkImage(
  check: TemplateDataCheck,
  node: ImageNode,
  path: string,
  scope: ValidationScope,
): void {
  if (!('var' in node.source)) return;

  const sourcePath = `${path}.source`;
  const type = checkVariableUse(check, node.source.var, sourcePath, scope);
  if (type !== undefined && type !== 'asset') {
    addError(check, sourcePath, `ảnh phải dùng biến kiểu "asset", "${node.source.var}" là "${type}"`);
  }
}

function checkRepeat(
  check: TemplateDataCheck,
  node: RepeatNode,
  path: string,
  scope: ValidationScope,
): void {
  const collection = check.index.collections.get(node.collection);
  if (!collection) {
    addError(check, `${path}.collection`, `dữ liệu template không có collection "${node.collection}"`);
    return;
  }
  if (collection.parent !== null && !scope.collections.includes(collection.parent)) {
    const parentLabel = collectionLabel(check, collection.parent);
    const message = `collection "${node.collection}" chỉ lặp được bên trong vòng lặp "${parentLabel}"`;
    addError(check, `${path}.collection`, message);
  }
  if (node.expand !== undefined) checkExpand(check, node, `${path}.expand`);

  const innerScope: ValidationScope = {
    collections: [...scope.collections, node.collection],
    expanded: node.expand !== undefined,
  };
  checkNode(check, node.template, `${path}.template`, innerScope);
}

function checkExpand(
  check: TemplateDataCheck,
  node: RepeatNode,
  path: string,
): void {
  const variable = node.expand === undefined ? undefined : check.index.variables.get(node.expand);
  if (!variable || variable.collection !== node.collection) {
    addError(check, path, `expand phải là biến của collection "${node.collection}"`);
    return;
  }

  const type = variable.description.type;
  if (type !== 'number') addError(check, path, `expand phải là biến kiểu "number", "${node.expand}" là "${type}"`);
}

function checkCondition(
  check: TemplateDataCheck,
  condition: Condition,
  path: string,
  scope: ValidationScope,
): void {
  switch (condition.op) {
    case 'and':
    case 'or':
      condition.conditions.forEach((child, index) =>
        checkCondition(check, child, `${path}.conditions[${index}]`, scope),
      );
      return;
    case 'not':
      checkCondition(check, condition.condition, `${path}.condition`, scope);
      return;
    default:
      checkVariableUse(check, condition.var, path, scope);
  }
}

/** Kiểm tra 1 lần dùng biến; trả kiểu biến nếu biến tồn tại. */
function checkVariableUse(
  check: TemplateDataCheck,
  name: string,
  path: string,
  scope: ValidationScope,
): VariableType | undefined {
  if (isBuiltInVariableName(name)) {
    checkBuiltInVariableScope(check, name, path, scope);
    return BUILT_IN_VARIABLE_TYPE;
  }

  const variable = check.index.variables.get(name);
  if (!variable) {
    addError(check, path, `dữ liệu template "${check.description.id}" không có biến "${name}"`);
    return undefined;
  }
  if (variable.collection !== null && !scope.collections.includes(variable.collection)) {
    const label = collectionLabel(check, variable.collection);
    addError(check, path, `biến "${name}" chỉ dùng được trong vòng lặp "${label}"`);
  }
  if (variable.description.deprecated !== undefined) {
    check.warnings.push({ path, message: `biến "${name}" đã ngừng dùng: ${variable.description.deprecated}` });
  }
  return variable.description.type;
}

function checkBuiltInVariableScope(
  check: TemplateDataCheck,
  name: BuiltInVariableName,
  path: string,
  scope: ValidationScope,
): void {
  const required = BUILT_IN_VARIABLE_SCOPES[name];
  if (required === 'repeat' && scope.collections.length === 0) {
    addError(check, path, `biến "${name}" chỉ dùng được bên trong repeat`);
  }
  if (required === 'expand' && !scope.expanded) {
    addError(check, path, `biến "${name}" chỉ dùng được bên trong repeat có expand`);
  }
}
