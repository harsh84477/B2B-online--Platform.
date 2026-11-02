import type { CatalogProvider, CatalogSnapshot } from "./types";

export class IntegrationCatalogProvider implements CatalogProvider {
  async getCatalog(): Promise<CatalogSnapshot> {
    throw new Error(
      "Catalog integration is not configured. Connect the approved integration boundary before loading POS data.",
    );
  }
}
