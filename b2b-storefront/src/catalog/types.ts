export interface CatalogCategory {
  id: string;
  name: string;
}

export interface CatalogPackOption {
  quantity: number;
  label: string;
  isEnabled: boolean;
}

export interface CatalogProduct {
  id: string;
  name: string;
  sku: string;
  categoryId: string | null;
  categoryName: string | null;
  brand: string | null;
  imageUrl: string | null;
  imageUrls: string[];
  packOptions: CatalogPackOption[];
  description: string | null;
  wholesalePrice: number | null;
  currency: string;
  availableQuantity: number | null;
  unitLabel: string | null;
}

export interface CatalogSnapshot {
  categories: CatalogCategory[];
  products: CatalogProduct[];
  ecommerce: {
    isEnabled: boolean;
    bannerEnabled: boolean;
    bannerTitle: string;
    bannerSubtitle: string;
    bannerImageUrl: string | null;
  };
}

export interface CatalogProvider {
  getCatalog(): Promise<CatalogSnapshot>;
}

export interface CustomerOrderLine {
  productId: string;
  quantity: number;
}

export interface CustomerOrder {
  lines: CustomerOrderLine[];
  customer: CustomerDetails;
}

export interface CustomerDetails {
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  notes: string;
}

export interface OrderProvider {
  submitOrder(order: CustomerOrder): Promise<{ orderId: string }>;
}
