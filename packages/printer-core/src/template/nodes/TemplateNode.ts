import type { ContainerNode } from './ContainerNode';
import type { TextNode } from './TextNode';
import type { LineNode } from './LineNode';
import type { BarcodeNode } from './BarcodeNode';
import type { QrCodeNode } from './QrCodeNode';
import type { ImageNode } from './ImageNode';
import type { RepeatNode } from './RepeatNode';

export type TemplateNode = ContainerNode | TextNode | LineNode | BarcodeNode | QrCodeNode | ImageNode | RepeatNode;

export type { ContainerNode, TextNode, LineNode, BarcodeNode, QrCodeNode, ImageNode, RepeatNode };
