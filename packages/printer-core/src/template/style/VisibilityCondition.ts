export type VisibilityCondition =
  | { readonly type: 'exists'; readonly binding: string }
  | { readonly type: 'equals'; readonly binding: string; readonly value: unknown };
