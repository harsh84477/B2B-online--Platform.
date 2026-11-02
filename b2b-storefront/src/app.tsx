import { useEffect, useMemo, useState } from "react";
import { IntegrationCatalogProvider } from "./catalog/provider";
import type { CatalogSnapshot } from "./catalog/types";

const emptyCatalog: CatalogSnapshot = { categories: [], products: [] };
const provider = new IntegrationCatalogProvider();

export function App() {
  const [catalog, setCatalog] = useState<CatalogSnapshot>(emptyCatalog);
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    provider
      .getCatalog()
      .then((snapshot) => {
        if (active) setCatalog(snapshot);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "Unable to load catalog.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const products = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return catalog.products.filter((product) => {
      const matchesCategory =
        categoryId === "all" || product.categoryId === categoryId;
      const matchesQuery =
        !normalizedQuery ||
        [product.name, product.sku, product.brand ?? ""].some((value) =>
          value.toLowerCase().includes(normalizedQuery),
        );
      return matchesCategory && matchesQuery;
    });
  }, [catalog.products, categoryId, query]);

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="/" aria-label="B2B Storefront home">
          <span className="brand-mark">B</span>
          <span>
            <strong>Wholesale Hub</strong>
            <small>Retailer storefront</small>
          </span>
        </a>
        <div className="header-actions">
          <span className="status-pill">Catalog preview</span>
          <button className="outline-button" type="button" disabled>
            Sign in
          </button>
          <button className="cart-button" type="button" disabled>
            Cart <span>0</span>
          </button>
        </div>
      </header>

      <main>
        <section className="hero">
          <div>
            <p className="eyebrow">Wholesale ordering, simplified</p>
            <h1>Stock up with confidence.</h1>
            <p className="hero-copy">
              Browse your approved wholesale catalog, check availability, and
              build your next order in one place.
            </p>
          </div>
          <div className="hero-card">
            <span className="hero-card-label">Built for retailers</span>
            <strong>Clear prices. Reliable stock.</strong>
            <span>Order workflows will connect through the POS integration layer.</span>
          </div>
        </section>

        <section className="catalog-section" aria-labelledby="catalog-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Product catalog</p>
              <h2 id="catalog-heading">Find what you need</h2>
            </div>
            <label className="search-field">
              <span className="sr-only">Search products</span>
              <input
                type="search"
                placeholder="Search products or SKU"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          </div>

          <div className="category-row" aria-label="Product categories">
            <button
              className={categoryId === "all" ? "category active" : "category"}
              type="button"
              onClick={() => setCategoryId("all")}
            >
              All products
            </button>
            {catalog.categories.map((category) => (
              <button
                className={categoryId === category.id ? "category active" : "category"}
                key={category.id}
                type="button"
                onClick={() => setCategoryId(category.id)}
              >
                {category.name}
              </button>
            ))}
          </div>

          {loading && <div className="state-card">Loading approved catalog…</div>}
          {!loading && error && (
            <div className="state-card error-state" role="alert">
              <strong>Catalog is not connected yet.</strong>
              <p>{error}</p>
              <small>
                No product data is shown until the integration boundary is configured.
              </small>
            </div>
          )}
          {!loading && !error && products.length === 0 && (
            <div className="state-card">
              <strong>No products available.</strong>
              <p>
                Connect the approved catalog source to display POS-owned products and
                availability.
              </p>
            </div>
          )}
          {!loading && !error && products.length > 0 && (
            <div className="product-grid">
              {products.map((product) => (
                <article className="product-card" key={product.id}>
                  <div className="product-image">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt="" />
                    ) : (
                      <span>{product.name.slice(0, 1).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="product-details">
                    <small>{product.brand ?? "Wholesale product"}</small>
                    <h3>{product.name}</h3>
                    <p>SKU {product.sku}</p>
                    <div className="product-footer">
                      <strong>
                        {product.wholesalePrice === null
                          ? "Price after sign in"
                          : `${product.currency}${product.wholesalePrice.toFixed(2)}`}
                      </strong>
                      <button type="button" disabled>
                        Add
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer>
        <span>Wholesale Hub</span>
        <span>POS-owned catalog · Secure integration pending</span>
      </footer>
    </div>
  );
}
