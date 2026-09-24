import type { BarcodeNode } from './BarcodeNode';
import type { ContainerNode } from './ContainerNode';
import type { ImageNode } from './ImageNode';
import type { LineNode } from './LineNode';
import type { QrCodeNode } from './QrCodeNode';
import type { RepeatNode } from './RepeatNode';
import type { TextNode } from './TextNode';

/** Mọi loại node của template, phân biệt theo `type`. */
export type TemplateNode = ContainerNode | TextNode | LineNode | BarcodeNode | QrCodeNode | ImageNode | RepeatNode;

/** Tên các loại node. */
export type TemplateNodeType = TemplateNode['type'];
