import { catalogApi } from '../api/catalogApi';
import { ALL_CATEGORY_ID } from '../types/catalog.types';
import type {
  CategorySelection,
  CategoryViewModel,
  PosCategoryDto,
  PosProductDto,
  PosTagDto,
  ProductViewModel,
} from '../types/catalog.types';

const toBadge = (
  tags: PosTagDto[],
): Pick<ProductViewModel, 'badgeLabel' | 'badgeColorHex' | 'badgeTextColorHex'> => {
  const primary = [...tags].sort((a, b) => a.DisplayOrder - b.DisplayOrder)[0];
  return primary
    ? {
        badgeLabel: primary.Name,
        badgeColorHex: primary.ColorHex ?? null,
        badgeTextColorHex: primary.TextColor ?? null,
      }
    : { badgeLabel: null, badgeColorHex: null, badgeTextColorHex: null };
};

const toProductViewModel = (dto: PosProductDto): ProductViewModel => ({
  id: dto.Id,
  categoryId: dto.CategoryId ?? null,
  name: dto.Name,
  price: dto.ResolvedPrice,
  imageUrl: dto.ImageUrl ?? null,
  isAvailable: dto.IsAvailable,
  sku: dto.Sku,
  ...toBadge(dto.Tags),
});

const toCategoryViewModel = (dto: PosCategoryDto): CategoryViewModel => ({
  id: dto.Id,
  parentId: dto.ParentId ?? null,
  name: dto.Name,
  productCount: dto.ProductCount,
  children: dto.Children.map(toCategoryViewModel),
});

const fetchCatalog = async (
  storeId: number,
): Promise<{ categories: CategoryViewModel[]; products: ProductViewModel[] }> => {
  const response = await catalogApi.getCatalogAsync(storeId);

  if (!response.IsSuccess) {
    throw new Error(response.Error?.Message ?? 'Không thể tải danh sách sản phẩm');
  }

  return {
    categories: (response.Data?.Categories ?? []).map(toCategoryViewModel),
    products: (response.Data?.Products ?? []).map(toProductViewModel),
  };
};

const collectCategoryIds = (category: CategoryViewModel): number[] => [
  category.id,
  ...category.children.flatMap(collectCategoryIds),
];

const findCategory = (nodes: CategoryViewModel[], categoryId: number): CategoryViewModel | null => {
  for (const node of nodes) {
    if (node.id === categoryId) return node;
    const found = findCategory(node.children, categoryId);
    if (found) return found;
  }
  return null;
};

const filterByCategory = (
  products: ProductViewModel[],
  categories: CategoryViewModel[],
  categoryId: CategorySelection,
): ProductViewModel[] => {
  if (categoryId === ALL_CATEGORY_ID) return products;

  const target = findCategory(categories, categoryId);
  if (!target) return [];

  const allowedIds = new Set(collectCategoryIds(target));
  return products.filter((product) => product.categoryId !== null && allowedIds.has(product.categoryId));
};

const stripDiacritics = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');

const matchTier = (product: ProductViewModel, lowerKeyword: string): 0 | 1 | 2 | null => {
  const sku = product.sku.toLowerCase();
  const name = product.name.toLowerCase();

  if (sku.includes(lowerKeyword)) return 0;
  if (name.includes(lowerKeyword)) return 1;
  if (stripDiacritics(name).includes(stripDiacritics(lowerKeyword))) return 2;
  return null;
};

const searchProducts = (products: ProductViewModel[], keyword: string): ProductViewModel[] => {
  const lowerKeyword = keyword.trim().toLowerCase();
  if (!lowerKeyword) return products;

  return products
    .map((product) => ({ product, tier: matchTier(product, lowerKeyword) }))
    .filter((entry): entry is { product: ProductViewModel; tier: 0 | 1 | 2 } => entry.tier !== null)
    .sort((a, b) => a.tier - b.tier)
    .map((entry) => entry.product);
};

export const CatalogService = { fetchCatalog, filterByCategory, searchProducts };
