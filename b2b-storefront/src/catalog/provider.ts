import type {
  CatalogProvider,
  CatalogSnapshot,
  CustomerOrder,
  OrderProvider,
} from "./types";

export class IntegrationCatalogProvider implements CatalogProvider {
  async getCatalog(): Promise<CatalogSnapshot> {
    throw new Error(
      "Catalog integration is not configured. Connect the approved integration boundary before loading POS data.",
    );
  }
}

export class IntegrationOrderProvider implements OrderProvider {
  async submitOrder(_order: CustomerOrder): Promise<{ orderId: string }> {
    throw new Error(
      "Order integration is not configured. Connect the approved integration boundary before submitting orders to the POS.",
    );
  }
}
