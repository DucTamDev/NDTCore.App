import type { ImageNode, RepeatNode, TemplateDocument, TemplateNode } from '../template';
import { createTemplateDataIndex, type TemplateDataDefinition } from '../template/data';
import type { AssetProvider } from './AssetProvider';
import { readCollectionItems } from './readRepeatEntries';
import { readVariableValue } from './readVariable';
import { COUNTING_PAGE, createRootFrame, pushFrame, type ResolveContext } from './ResolveContext';
import { ResolveError } from './ResolveError';

/** Asset rỗng — chỉ dùng khi duyệt cây để thu mã asset, không tra ảnh. */
const NO_ASSETS: AssetProvider = { get: () => undefined };

/**
 * Mã asset cần tải trước khi resolve: asset tĩnh trong template + giá trị các biến kiểu `asset` đang dùng
 * (duyệt mọi phần tử của mọi `repeat`, bỏ qua điều kiện ẩn/hiện). Không trùng lặp, theo thứ tự gặp.
 */
export function collectAssetIds<TData>(
  template: TemplateDocument,
  templateData: TemplateDataDefinition<TData>,
  data: TData,
): readonly string[] {
  const context: ResolveContext = {
    templateData,
    index: createTemplateDataIndex(templateData.describe()),
    assets: NO_ASSETS,
    frames: [createRootFrame(data)],
    page: COUNTING_PAGE,
    settings: template.settings,
  };
  const assetIds = new Set<string>();
  collectFromNode(template.content, context, assetIds);
  return [...assetIds];
}

function collectFromNode(
  templateNode: TemplateNode,
  context: ResolveContext,
  assetIds: Set<string>,
): void {
  switch (templateNode.type) {
    case 'image':
      collectFromImage(templateNode, context, assetIds);
      return;
    case 'container':
      templateNode.children.forEach((child) => collectFromNode(child, context, assetIds));
      return;
    case 'repeat':
      collectFromRepeat(templateNode, context, assetIds);
      return;
    default:
      return;
  }
}

function collectFromImage(
  image: ImageNode,
  context: ResolveContext,
  assetIds: Set<string>,
): void {
  if ('asset' in image.source) {
    assetIds.add(image.source.asset);
    return;
  }

  const variable = image.source.var;
  const value = readOrUndefined(() => readVariableValue(context, variable, image.id));
  if (typeof value === 'string' && value !== '') assetIds.add(value);
}

function collectFromRepeat(
  repeat: RepeatNode,
  context: ResolveContext,
  assetIds: Set<string>,
): void {
  const items = readOrUndefined(() => readCollectionItems(repeat, context)) ?? [];
  for (const item of items) {
    const itemContext = pushFrame(context, {
      collection: repeat.collection,
      item,
      position: 0,
      total: 0,
      unit: 0,
      unitCount: 0,
      expanded: false,
    });
    collectFromNode(repeat.template, itemContext, assetIds);
  }
}

// Data lỗi thì bỏ qua ở bước thu mã asset; lỗi sẽ hiện ra đúng trang khi resolve.
function readOrUndefined<TValue>(read: () => TValue): TValue | undefined {
  try {
    return read();
  } catch (error) {
    if (error instanceof ResolveError) return undefined;
    throw error;
  }
}
