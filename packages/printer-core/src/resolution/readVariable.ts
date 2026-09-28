import {
  BUILT_IN_VARIABLE_SCOPES,
  isBuiltInVariableName,
  type BuiltInVariableName,
  type VariableType,
} from '../template/data';
import { findScopeFrame, innermostFrame, type ResolveContext } from './ResolveContext';
import { errorMessage, ResolveError } from './ResolveError';

type BuiltInVariableReader = (context: ResolveContext) => number;

const BUILT_IN_VARIABLE_READERS: Readonly<Record<BuiltInVariableName, BuiltInVariableReader>> = {
  $position: (context) => innermostFrame(context).position,
  $total: (context) => innermostFrame(context).total,
  $unit: (context) => innermostFrame(context).unit,
  $unitCount: (context) => innermostFrame(context).unitCount,
  $page: (context) => context.page.pageNumber,
  $pageCount: (context) => context.page.pageCount,
  $part: (context) => context.page.part?.number ?? 1,
  $partCount: (context) => context.page.part?.count ?? 1,
};

/**
 * Giá trị raw của biến (chưa format, có thể `undefined`). Biến collection lấy từ đúng tầng scope của
 * collection đó — không dò ngược lên scope ngoài, nên không bao giờ khớp nhầm biến trùng tên.
 */
export function readVariableValue(
  context: ResolveContext,
  name: string,
  nodeId: string,
): unknown {
  if (isBuiltInVariableName(name)) {
    checkBuiltInVariableScope(context, name, nodeId);
    return BUILT_IN_VARIABLE_READERS[name](context);
  }

  const variable = context.index.variables.get(name);
  if (!variable) throw new ResolveError(nodeId, `catalog không có biến "${name}"`);

  const frame = findScopeFrame(context, variable.collection);
  if (!frame) throw new ResolveError(nodeId, `biến "${name}" chỉ dùng được trong vòng lặp "${variable.collection}"`);

  return readFromTemplateData(nodeId, name, () => context.catalog.readVariable(name, frame.item));
}

/** Chặn biến có sẵn dùng sai scope (VD `$position` ở ngoài repeat) — nếu không sẽ âm thầm in giá trị `0`. */
function checkBuiltInVariableScope(
  context: ResolveContext,
  name: BuiltInVariableName,
  nodeId: string,
): void {
  const required = BUILT_IN_VARIABLE_SCOPES[name];
  if (required === 'repeat' && context.frames.length === 1) {
    throw new ResolveError(nodeId, `biến "${name}" chỉ dùng được bên trong repeat`);
  }
  if (required === 'expand' && !innermostFrame(context).expanded) {
    throw new ResolveError(nodeId, `biến "${name}" chỉ dùng được bên trong repeat có expand`);
  }
}

/** Kiểu của biến; biến có sẵn luôn là `number`. */
export function variableTypeOf(context: ResolveContext, name: string): VariableType {
  return context.index.variables.get(name)?.description.type ?? 'number';
}

/** Biến có được phép rỗng không; biến có sẵn luôn có giá trị. */
export function isOptionalVariable(context: ResolveContext, name: string): boolean {
  return context.index.variables.get(name)?.description.optional ?? false;
}

/** Gọi hàm `get` của catalog; lỗi trong `get` (data sai cấu trúc) thành lỗi trang thay vì làm hỏng cả lần in. */
export function readFromTemplateData(
  nodeId: string,
  name: string,
  read: () => unknown,
): unknown {
  try {
    return read();
  } catch (error) {
    throw new ResolveError(nodeId, `không đọc được "${name}" từ data: ${errorMessage(error)}`);
  }
}
