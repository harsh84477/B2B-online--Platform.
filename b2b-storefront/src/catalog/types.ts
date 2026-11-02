export interface CatalogCategory {
  id: string;
  name: string;
}

export interface CatalogProduct {
  id: string;
  name: string;
  sku: string;
  categoryId: string | null;
  categoryName: string | null;
  brand: string | null;
  imageUrl: string | null;
  wholesalePrice: number | null;
  currency: string;
  availableQuantity: number | null;
  unitLabel: string | null;
}

export interface CatalogSnapshot {
  categories: CatalogCategory[];
  products: CatalogProduct[];
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
}

export interface OrderProvider {
  submitOrder(order: CustomerOrder): Promise<{ orderId: string }>;
}
