import { useEffect, useMemo, useState } from "react";
import {
  IntegrationCatalogProvider,
  IntegrationOrderProvider,
} from "./catalog/provider";
import type {
  CatalogProduct,
  CatalogSnapshot,
  CustomerOrderLine,
} from "./catalog/types";

type UserType = "owner" | "customer";
type Cart = Record<string, number>;

const emptyCatalog: CatalogSnapshot = { categories: [], products: [] };
const catalogProvider = new IntegrationCatalogProvider();
const orderProvider = new IntegrationOrderProvider();
const posUrl = import.meta.env.VITE_POS_URL as string | undefined;

export function App() {
  const [userType, setUserType] = useState<UserType | null>(null);

  if (!userType) {
    return <RoleSelection onSelect={setUserType} />;
  }

  if (userType === "owner") {
    return <OwnerEntry onBack={() => setUserType(null)} />;
  }

  return <CustomerStore onBack={() => setUserType(null)} />;
}

function RoleSelection({ onSelect }: { onSelect: (type: UserType) => void }) {
  return (
    <div className="app-shell centered-shell">
      <main className="role-page">
        <div className="role-intro">
          <span className="brand-mark">B</span>
          <p className="eyebrow">Wholesale Hub</p>
          <h1>Welcome. How are you using the platform?</h1>
          <p>
            Choose the workspace that matches your role. Your business owner
            workspace stays in the POS, while retailers order through the
            storefront.
          </p>
        </div>
        <div className="role-grid">
          <button className="role-card" type="button" onClick={() => onSelect("owner")}>
            <span className="role-icon">▣</span>
            <strong>I am the business owner</strong>
            <small>Manage products, inventory, billing, customers, and operations in the POS.</small>
            <span className="role-link">Continue to POS →</span>
          </button>
          <button className="role-card" type="button" onClick={() => onSelect("customer")}>
            <span className="role-icon">🛒</span>
            <strong>I am a retailer / customer</strong>
            <small>Browse wholesale products, add items to your cart, and place an order.</small>
            <span className="role-link">Shop wholesale →</span>
          </button>
        </div>
        <p className="role-note">Orders are designed to flow to the POS through the secure integration layer.</p>
      </main>
    </div>
  );
}

function OwnerEntry({ onBack }: { onBack: () => void }) {
  const [error, setError] = useState<string | null>(null);

  function openPos() {
    if (!posUrl) {
      setError("The POS URL is not configured. Set VITE_POS_URL before connecting this button.");
      return;
    }
    window.location.assign(posUrl);
  }

  return (
    <div className="app-shell centered-shell">
      <main className="entry-card">
        <span className="role-icon">▣</span>
        <p className="eyebrow">Business owner workspace</p>
        <h1>Continue to your POS</h1>
        <p>
          Products, inventory, billing, pricing, customers, and order
          acceptance remain managed by the existing POS.
        </p>
        {error && <div className="inline-error" role="alert">{error}</div>}
        <button className="primary-button wide-button" type="button" onClick={openPos}>
          Open POS
        </button>
        <button className="text-button" type="button" onClick={onBack}>← Choose a different role</button>
      </main>
    </div>
  );
}

function CustomerStore({ onBack }: { onBack: () => void }) {
  const [catalog, setCatalog] = useState<CatalogSnapshot>(emptyCatalog);
  const [cart, setCart] = useState<Cart>({});
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orderMessage, setOrderMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    catalogProvider.getCatalog().then((snapshot) => {
      if (active) setCatalog(snapshot);
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Unable to load catalog.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const products = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return catalog.products.filter((product) => {
      const matchesCategory = categoryId === "all" || product.categoryId === categoryId;
      const matchesQuery = !normalizedQuery || [product.name, product.sku, product.brand ?? ""]
        .some((value) => value.toLowerCase().includes(normalizedQuery));
      return matchesCategory && matchesQuery;
    });
  }, [catalog.products, categoryId, query]);

  const cartLines = useMemo(
    () => Object.entries(cart).filter(([, quantity]) => quantity > 0),
    [cart],
  );
  const cartCount = cartLines.reduce((total, [, quantity]) => total + quantity, 0);

  function addToCart(product: CatalogProduct) {
    setCart((current) => ({ ...current, [product.id]: (current[product.id] ?? 0) + 1 }));
    setOrderMessage(null);
  }

  function updateQuantity(productId: string, quantity: number) {
    setCart((current) => {
      const next = { ...current };
      if (quantity <= 0) delete next[productId];
      else next[productId] = quantity;
      return next;
    });
  }

  async function submitOrder() {
    const lines: CustomerOrderLine[] = cartLines.map(([productId, quantity]) => ({ productId, quantity }));
    try {
      const result = await orderProvider.submitOrder({ lines });
      setOrderMessage(`Order ${result.orderId} was submitted to the POS.`);
    } catch (cause: unknown) {
      setOrderMessage(cause instanceof Error ? cause.message : "Unable to submit order.");
    }
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <button className="brand brand-button" type="button" onClick={onBack}>
          <span className="brand-mark">B</span>
          <span><strong>Wholesale Hub</strong><small>Retailer storefront</small></span>
        </button>
        <div className="header-actions">
          <span className="status-pill">Retailer shopping</span>
          <button className="cart-button" type="button" onClick={() => document.getElementById("cart")?.scrollIntoView({ behavior: "smooth" })}>
            Cart <span>{cartCount}</span>
          </button>
        </div>
      </header>
      <main>
        <section className="hero">
          <div>
            <p className="eyebrow">Wholesale ordering, simplified</p>
            <h1>Stock up with confidence.</h1>
            <p className="hero-copy">Browse approved wholesale products, build your order, and send it to the business POS.</p>
          </div>
          <div className="hero-card"><span className="hero-card-label">For retailers</span><strong>Clear prices. Reliable stock.</strong><span>Your order will be accepted and managed by the business POS.</span></div>
        </section>
        <section className="catalog-section" aria-labelledby="catalog-heading">
          <div className="section-heading">
            <div><p className="eyebrow">Product catalog</p><h2 id="catalog-heading">Find what you need</h2></div>
            <label className="search-field"><span className="sr-only">Search products</span><input type="search" placeholder="Search products or SKU" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          </div>
          <div className="category-row" aria-label="Product categories">
            <button className={categoryId === "all" ? "category active" : "category"} type="button" onClick={() => setCategoryId("all")}>All products</button>
            {catalog.categories.map((category) => <button className={categoryId === category.id ? "category active" : "category"} key={category.id} type="button" onClick={() => setCategoryId(category.id)}>{category.name}</button>)}
          </div>
          {loading && <div className="state-card">Loading approved catalog…</div>}
          {!loading && error && <div className="state-card error-state" role="alert"><strong>Catalog is not connected yet.</strong><p>{error}</p><small>No product data is shown until the integration boundary is configured.</small></div>}
          {!loading && !error && products.length === 0 && <div className="state-card"><strong>No products available.</strong><p>Connect the approved catalog source to display POS-owned products and availability.</p></div>}
          {!loading && !error && products.length > 0 && <div className="product-grid">{products.map((product) => <article className="product-card" key={product.id}><div className="product-image">{product.imageUrl ? <img src={product.imageUrl} alt="" /> : <span>{product.name.slice(0, 1).toUpperCase()}</span>}</div><div className="product-details"><small>{product.brand ?? "Wholesale product"}</small><h3>{product.name}</h3><p>SKU {product.sku}</p><div className="product-footer"><strong>{product.wholesalePrice === null ? "Price after sign in" : `${product.currency}${product.wholesalePrice.toFixed(2)}`}</strong><button className="primary-button" type="button" onClick={() => addToCart(product)}>Add</button></div></div></article>)}</div>}
        </section>
        <section className="cart-section" id="cart" aria-labelledby="cart-heading">
          <div><p className="eyebrow">Your order</p><h2 id="cart-heading">Cart and checkout</h2></div>
          {cartLines.length === 0 ? <div className="state-card"><strong>Your cart is empty.</strong><p>Add products from the catalog to prepare an order for the POS.</p></div> : <div className="cart-card"><div className="cart-lines">{cartLines.map(([productId, quantity]) => { const product = catalog.products.find((item) => item.id === productId); if (!product) return null; return <div className="cart-line" key={productId}><div><strong>{product.name}</strong><small>SKU {product.sku}</small></div><div className="quantity-control"><button type="button" onClick={() => updateQuantity(productId, quantity - 1)}>−</button><span>{quantity}</span><button type="button" onClick={() => updateQuantity(productId, quantity + 1)}>+</button></div></div>; })}</div><div className="checkout-row"><strong>{cartCount} item{cartCount === 1 ? "" : "s"}</strong><button className="primary-button" type="button" onClick={submitOrder}>Place order</button></div>{orderMessage && <div className="inline-error" role="status">{orderMessage}</div>}</div>}
        </section>
      </main>
      <footer><span>Wholesale Hub</span><span>POS-owned catalog · Secure integration pending</span></footer>
    </div>
  );
}
