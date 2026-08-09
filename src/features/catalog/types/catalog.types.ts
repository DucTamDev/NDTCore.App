export interface PosTagDto {
  Id: number;
  Name: string;
  ColorHex?: string | null;
  TextColor?: string | null;
  DisplayOrder: number;
}

export interface PosOptionDto {
  Id: number;
  Name: string;
  ResolvedPrice: number;
  IsDefault: boolean;
  IsAvailable: boolean;
  DisplayOrder: number;
}

export interface PosOptionGroupDto {
  GroupId: number;
  GroupName: string;
  UiType: string;
  IsRequired: boolean;
  MinSelect: number;
  MaxSelect: number;
  DisplayOrder: number;
  Options: PosOptionDto[];
}

export interface PosProductDto {
  Id: number;
  CategoryId: number | null;
  Sku: string;
  Name: string;
  ShortDescription?: string | null;
  ResolvedPrice: number;
  IsAvailable: boolean;
  DisplayOrder: number;
  ImageUrl?: string | null;
  Tags: PosTagDto[];
  OptionGroups: PosOptionGroupDto[];
}

export interface PosCategoryDto {
  Id: number;
  ParentId: number | null;
  Name: string;
  ProductCount: number;
  Children: PosCategoryDto[];
}

export interface PosCatalogDto {
  Categories: PosCategoryDto[];
  Products: PosProductDto[];
}

export interface OptionViewModel {
  id: number;
  name: string;
  price: number;
  isDefault: boolean;
  isAvailable: boolean;
}

export interface OptionGroupViewModel {
  groupId: number;
  groupName: string;
  uiType: 'SingleSelect' | 'MultiSelect';
  isRequired: boolean;
  minSelect: number;
  maxSelect: number;
  options: OptionViewModel[];
}

export const ALL_CATEGORY_ID = 'all' as const;
export type CategorySelection = typeof ALL_CATEGORY_ID | number;

export interface CategoryViewModel {
  id: number;
  parentId: number | null;
  name: string;
  productCount: number;
  children: CategoryViewModel[];
}

export interface ProductViewModel {
  id: number;
  categoryId: number | null;
  name: string;
  price: number;
  imageUrl: string | null;
  isAvailable: boolean;
  sku: string;
  badgeLabel: string | null;
  badgeColorHex: string | null;
  badgeTextColorHex: string | null;
  optionGroups: OptionGroupViewModel[];
}
