import type { PrintTemplate } from '../template/PrintTemplate';
import type { TemplateNode } from '../template/nodes/TemplateNode';
import type { Bitmap } from '../types';
import type { PrintData } from './PrintData';
import type { ResolvedNode } from './ResolvedNode';
import type { ResolvedPage } from './ResolvedPage';

type Scope = { readonly data: unknown; readonly parent: Scope | null };

function getPath(value: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (current === null || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[key];
  }, value);
}

function lookup(scope: Scope, path: string): unknown {
  let current: Scope | null = scope;
  while (current) {
    const value = getPath(current.data, path);
    if (value !== undefined) return value;
    current = current.parent;
  }
  return undefined;
}

function evaluateVisibility(node: TemplateNode, scope: Scope): boolean {
  if (!('visibleWhen' in node) || !node.visibleWhen) return true;
  const condition = node.visibleWhen;
  if (condition.type === 'exists') return lookup(scope, condition.binding) !== undefined;
  return lookup(scope, condition.binding) === condition.value;
}

class ResolveError extends Error {
  constructor(readonly nodeId: string, message: string) { super(message); }
}

function resolveNode(node: TemplateNode, scope: Scope): ResolvedNode | null {
  if (!evaluateVisibility(node, scope)) return null;

  switch (node.type) {
    case 'container':
      return {
        type: 'container',
        id: node.id,
        style: node.style,
        children: node.children.map((child) => resolveNode(child, scope)).filter((child): child is ResolvedNode => child !== null),
      };

    case 'text': {
      if (node.text !== undefined) return { type: 'text', id: node.id, value: node.text, style: node.style };
      if (node.binding === undefined) throw new ResolveError(node.id, `TextNode "${node.id}" has neither text nor binding`);
      const value = lookup(scope, node.binding);
      if (value === undefined) throw new ResolveError(node.id, `binding "${node.binding}" not found for node "${node.id}"`);
      return { type: 'text', id: node.id, value: String(value), style: node.style };
    }

    case 'line':
      return { type: 'line', id: node.id, thickness: node.thickness, style: node.style };

    case 'barcode': {
      const value = node.content ?? (node.binding !== undefined ? lookup(scope, node.binding) : undefined);
      if (value === undefined) throw new ResolveError(node.id, `barcode "${node.id}" has no content/binding value`);
      return { type: 'barcode', id: node.id, value: String(value), symbology: node.symbology, readable: node.readable, style: node.style };
    }

    case 'qrcode': {
      const value = node.content ?? (node.binding !== undefined ? lookup(scope, node.binding) : undefined);
      if (value === undefined) throw new ResolveError(node.id, `qrcode "${node.id}" has no content/binding value`);
      return { type: 'qrcode', id: node.id, value: String(value), errorCorrection: node.errorCorrection, style: node.style };
    }

    case 'image': {
      const bitmap = node.bitmap ?? (node.binding !== undefined ? lookup(scope, node.binding) : undefined);
      if (bitmap === undefined) throw new ResolveError(node.id, `image "${node.id}" has no bitmap/binding value`);
      if (typeof bitmap !== 'object' || bitmap === null || !('data' in bitmap) || !('width' in bitmap) || !('height' in bitmap) || !('bytesPerRow' in bitmap)) {
        throw new ResolveError(node.id, `image "${node.id}" binding value is not a valid Bitmap`);
      }
      return { type: 'image', id: node.id, bitmap: bitmap as Bitmap, style: node.style };
    }

    case 'repeat': {
      const items = lookup(scope, node.binding);
      if (!Array.isArray(items)) throw new ResolveError(node.id, `repeat "${node.id}" binding "${node.binding}" is not an array`);
      const children = items
        .map((item) => resolveNode(node.template, { data: item, parent: scope }))
        .filter((child): child is ResolvedNode => child !== null);
      return { type: 'container', id: node.id, children };
    }
  }
}

export class DocumentResolver {
  resolve(template: PrintTemplate, data: PrintData): readonly ResolvedPage[] {
    const scope: Scope = { data, parent: null };
    try {
      const node = resolveNode(template.root, scope);
      return [{ status: 'ok', pageIndex: 0, node: node ?? { type: 'container', id: template.root.id, children: [] } }];
    } catch (error) {
      if (error instanceof ResolveError) return [{ status: 'error', pageIndex: 0, nodeId: error.nodeId, message: error.message }];
      throw error;
    }
  }
}

export function createDocumentResolver(): DocumentResolver { return new DocumentResolver(); }
