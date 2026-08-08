export interface StoreDto {
  Id: number;
  Name: string;
  Code: string;
  LogoUrl?: string | null;
  IsActive: boolean;
  IsAcceptingOrders: boolean;
  Address?: string | null;
  District?: string | null;
  Province?: string | null;
}

export interface StoreViewModel {
  id: number;
  name: string;
  code: string;
  logoUrl: string | null;
  isActive: boolean;
  isAcceptingOrders: boolean;
  address: string | null;
  district: string | null;
  province: string | null;
}
