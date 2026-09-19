export type Dimension =
  | { readonly type: 'fixed'; readonly value: number }
  | { readonly type: 'fill' }
  | { readonly type: 'auto' };
