export interface FontScaleLevel {
  readonly id: string;
  readonly fontScale: number;
  readonly lineHeightScale: number;
}

export interface TypographyProfile {
  readonly fontScaleLevels: readonly FontScaleLevel[];
}
