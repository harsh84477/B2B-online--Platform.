import type {
  CatalogProvider,
  CatalogSnapshot,
  CustomerOrder,
  OrderProvider,
} from "./types";

const DEFAULT_SUPABASE_URL = "https://tsmkzfqxilpvhgeiyvcy.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_pqoyZca-gItLyCk-dB3-lg_QAX3YCle";

function getSupabaseConfig() {
  const url = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Storefront catalog is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.",
    );
  }
  return { url, key };
}

function getHeaders(key: string) {
  return { apikey: key, Authorization: "Bearer " + key };
}

export class IntegrationCatalogProvider implements CatalogProvider {
  async getCatalog(): Promise<CatalogSnapshot> {
    const { url, key } = getSupabaseConfig();
    const headers = getHeaders(key);
    const [productsResponse, categoriesResponse] = await Promise.all([
      fetch(
        `${url}/rest/v1/products?select=id,name,sku,category_id,brand,image_url,description,wholesale_price,current_stock,pack_name,base_unit&order=name`,
        { headers },
      ),
      fetch(`${url}/rest/v1/categories?select=id,name&order=sort_order`, { headers }),
    ]);
    if (!productsResponse.ok || !categoriesResponse.ok) {
      throw new Error("Unable to load the ecommerce catalog from the POS.");
    }

    const products = (await productsResponse.json()) as Array<{
      id: string;
      name: string;
      sku: string;
      category_id: string | null;
      brand: string | null;
      image_url: string | null;
      description: string | null;
      wholesale_price: number | null;
      current_stock: number | null;
      pack_name: string | null;
      base_unit: string | null;
    }>;
    const categories = (await categoriesResponse.json()) as Array<{ id: string; name: string }>;
    return {
      categories,
      products: products.map((product) => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        categoryId: product.category_id,
        categoryName: categories.find((category) => category.id === product.category_id)?.name ?? null,
        brand: product.brand,
        imageUrl: product.image_url,
        description: product.description,
        wholesalePrice: product.wholesale_price,
        currency: "₹",
        availableQuantity: product.current_stock,
        unitLabel: product.pack_name ?? product.base_unit,
      })),
    };
  }
}

export class IntegrationOrderProvider implements OrderProvider {
  async submitOrder(order: CustomerOrder): Promise<{ orderId: string }> {
    const { url, key } = getSupabaseConfig();
    const response = await fetch(`${url}/rest/v1/rpc/submit_online_order`, {
      method: "POST",
      headers: {
        ...getHeaders(key),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ _lines: order.lines }),
    });

    if (!response.ok) {
      const details = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(details?.message ?? "Unable to submit the order to the POS.");
    }

    const orderId = (await response.json()) as unknown;
    if (typeof orderId !== "string") {
      throw new Error("The POS returned an invalid order confirmation.");
    }
    return { orderId };
  }
}
