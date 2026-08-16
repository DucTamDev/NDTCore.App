import { CatalogService } from '../CatalogService';
import { catalogApi } from '../../api/catalogApi';
import { ALL_CATEGORY_ID } from '../../types/catalog.types';
import type { CategoryViewModel, ProductViewModel } from '../../types/catalog.types';

jest.mock('../../api/catalogApi', () => ({
  catalogApi: { getCatalogAsync: jest.fn() },
}));

function makeProduct(overrides: Partial<ProductViewModel>): ProductViewModel {
  return {
    id: 1,
    categoryId: null,
    name: 'Sản phẩm',
    price: 10000,
    imageUrl: null,
    isAvailable: true,
    sku: 'SKU',
    badgeLabel: null,
    badgeColorHex: null,
    badgeTextColorHex: null,
    optionGroups: [],
    ...overrides,
  };
}

describe('CatalogService.fetchCatalog', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('maps categories and products from DTO to ViewModel on success', async () => {
    (catalogApi.getCatalogAsync as jest.Mock).mockResolvedValue({
      IsSuccess: true,
      Data: {
        Categories: [
          {
            Id: 1,
            ParentId: null,
            Name: 'Trà sữa',
            ProductCount: 2,
            Children: [{ Id: 2, ParentId: 1, Name: 'Trà sữa size L', ProductCount: 1, Children: [] }],
          },
        ],
        Products: [
          {
            Id: 10,
            CategoryId: 2,
            Sku: 'TS001',
            Name: 'Trà sữa Olong',
            ShortDescription: null,
            ResolvedPrice: 45000,
            IsAvailable: true,
            DisplayOrder: 1,
            ImageUrl: null,
            Tags: [
              { Id: 1, Name: 'HOT', ColorHex: '#EF4444', TextColor: '#FFFFFF', DisplayOrder: 1 },
              { Id: 2, Name: 'NEW', ColorHex: '#10B981', TextColor: '#FFFFFF', DisplayOrder: 2 },
            ],
            OptionGroups: [
              {
                GroupId: 1,
                GroupName: 'Size',
                UiType: 'SingleSelect',
                IsRequired: true,
                MinSelect: 1,
                MaxSelect: 1,
                DisplayOrder: 1,
                Options: [
                  { Id: 1, Name: 'M', ResolvedPrice: 0, IsDefault: true, IsAvailable: true, DisplayOrder: 1 },
                  { Id: 2, Name: 'L', ResolvedPrice: 5000, IsDefault: false, IsAvailable: true, DisplayOrder: 2 },
                ],
              },
            ],
          },
        ],
      },
      Message: null,
      Error: null,
    });

    const result = await CatalogService.fetchCatalog(7);

    expect(result.categories).toEqual([
      {
        id: 1,
        parentId: null,
        name: 'Trà sữa',
        productCount: 2,
        children: [{ id: 2, parentId: 1, name: 'Trà sữa size L', productCount: 1, children: [] }],
      },
    ]);
    expect(result.products).toEqual([
      {
        id: 10,
        categoryId: 2,
        name: 'Trà sữa Olong',
        price: 45000,
        imageUrl: null,
        isAvailable: true,
        sku: 'TS001',
        badgeLabel: 'HOT',
        badgeColorHex: '#EF4444',
        badgeTextColorHex: '#FFFFFF',
        optionGroups: [
          {
            groupId: 1,
            groupName: 'Size',
            uiType: 'SingleSelect',
            isRequired: true,
            minSelect: 1,
            maxSelect: 1,
            options: [
              { id: 1, name: 'M', price: 0, isDefault: true, isAvailable: true },
              { id: 2, name: 'L', price: 5000, isDefault: false, isAvailable: true },
            ],
          },
        ],
      },
    ]);
    expect(catalogApi.getCatalogAsync).toHaveBeenCalledWith(7);
  });

  it('throws the backend error message on failure', async () => {
    (catalogApi.getCatalogAsync as jest.Mock).mockResolvedValue({
      IsSuccess: false,
      Data: null,
      Message: null,
      Error: { ErrorCode: 'FORBIDDEN', Message: 'Không có quyền truy cập cửa hàng này' },
    });

    await expect(CatalogService.fetchCatalog(7)).rejects.toThrow('Không có quyền truy cập cửa hàng này');
  });

  it('maps a product with no tags to a null badge', async () => {
    (catalogApi.getCatalogAsync as jest.Mock).mockResolvedValue({
      IsSuccess: true,
      Data: {
        Categories: [],
        Products: [
          {
            Id: 11,
            CategoryId: null,
            Sku: 'TS002',
            Name: 'Trà đào',
            ShortDescription: null,
            ResolvedPrice: 39000,
            IsAvailable: true,
            DisplayOrder: 1,
            ImageUrl: null,
            Tags: [],
            OptionGroups: [],
          },
        ],
      },
      Message: null,
      Error: null,
    });

    const result = await CatalogService.fetchCatalog(7);
    expect(result.products[0].badgeLabel).toBeNull();
    expect(result.products[0].categoryId).toBeNull();
  });
});

describe('CatalogService.filterByCategory', () => {
  const parent: CategoryViewModel = {
    id: 1,
    parentId: null,
    name: 'Trà sữa',
    productCount: 2,
    children: [{ id: 2, parentId: 1, name: 'Size L', productCount: 1, children: [] }],
  };
  const other: CategoryViewModel = { id: 3, parentId: null, name: 'Coffee', productCount: 1, children: [] };
  const categories = [parent, other];

  const productInChild = makeProduct({ id: 100, categoryId: 2 });
  const productInParentDirectly = makeProduct({ id: 101, categoryId: 1 });
  const productInOther = makeProduct({ id: 102, categoryId: 3 });
  const products = [productInChild, productInParentDirectly, productInOther];

  it('returns all products when categoryId is ALL_CATEGORY_ID', () => {
    expect(CatalogService.filterByCategory(products, categories, ALL_CATEGORY_ID)).toEqual(products);
  });

  it('includes products of child categories when a parent category is selected', () => {
    const result = CatalogService.filterByCategory(products, categories, 1);
    expect(result).toEqual([productInChild, productInParentDirectly]);
  });

  it('returns an empty array when the categoryId does not exist in the tree', () => {
    expect(CatalogService.filterByCategory(products, categories, 999)).toEqual([]);
  });
});

describe('CatalogService.searchProducts', () => {
  const products = [
    makeProduct({ id: 1, sku: 'TD001', name: 'Trà đào cam sả' }),
    makeProduct({ id: 2, sku: 'CF001', name: 'Cà phê đen' }),
    makeProduct({ id: 3, sku: 'TS-DAO', name: 'Trân châu' }),
  ];

  it('returns all products when keyword is empty', () => {
    expect(CatalogService.searchProducts(products, '')).toEqual(products);
  });

  it('matches by SKU first, then by name without diacritics', () => {
    const result = CatalogService.searchProducts(products, 'dao');
    expect(result.map((p) => p.id)).toEqual([3, 1]);
  });

  it('matches case-insensitively with diacritics', () => {
    const result = CatalogService.searchProducts(products, 'CÀ PHÊ');
    expect(result.map((p) => p.id)).toEqual([2]);
  });

  it('returns an empty array when nothing matches', () => {
    expect(CatalogService.searchProducts(products, 'americano')).toEqual([]);
  });
});
