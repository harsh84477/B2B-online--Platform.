import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  IntegrationCatalogProvider,
  IntegrationOrderProvider,
} from "./catalog/provider";
import type {
  CatalogProduct,
  CatalogSnapshot,
  CustomerDetails,
  CustomerOrderLine,
} from "./catalog/types";

type UserType = "owner" | "customer";
type CartLine = { quantity: number; packQuantity: number };
type Cart = Record<string, CartLine>;
type Page = "catalog" | "product" | "login" | "checkout";

const emptyCatalog: CatalogSnapshot = {
  categories: [],
  products: [],
  ecommerce: {
    isEnabled: true,
    bannerEnabled: true,
    bannerTitle: "Stock up with confidence.",
    bannerSubtitle: "Browse approved wholesale products and send your order to the POS.",
    bannerImageUrl: null,
  },
};
const emptyCustomer: CustomerDetails = {
  businessName: "",
  contactName: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  postalCode: "",
  notes: "",
};
const catalogProvider = new IntegrationCatalogProvider();
const orderProvider = new IntegrationOrderProvider();
const posUrl = import.meta.env.VITE_POS_URL as string | undefined;

export function App() {
  const [userType, setUserType] = useState<UserType | null>(null);
  if (!userType) return <RoleSelection onSelect={setUserType} />;
  if (userType === "owner") return <OwnerEntry onBack={() => setUserType(null)} />;
  return <CustomerStore onBack={() => setUserType(null)} />;
}

function RoleSelection({ onSelect }: { onSelect: (type: UserType) => void }) {
  return (
    <div className="app-shell centered-shell">
      <main className="role-page">
        <div className="role-intro">
          <span className="brand-mark">B</span>
          <p className="eyebrow">Wholesale Hub</p>
          <h1>Everything your business needs, in one place.</h1>
          <p>Choose your workspace to browse wholesale products or manage the business POS.</p>
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
        <p className="role-note">Secure ordering for approved retail partners.</p>
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
        <p>Products, inventory, billing, pricing, customers, and order acceptance remain managed by the existing POS.</p>
        {error && <div className="inline-error" role="alert">{error}</div>}
        <button className="primary-button wide-button" type="button" onClick={openPos}>Open POS</button>
        <button className="text-button" type="button" onClick={onBack}>← Choose a different role</button>
      </main>
    </div>
  );
}

function CustomerStore({ onBack }: { onBack: () => void }) {
  const [catalog, setCatalog] = useState<CatalogSnapshot>(emptyCatalog);
  const [cart, setCart] = useState<Cart>({});
  const [page, setPage] = useState<Page>("catalog");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orderMessage, setOrderMessage] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [customer, setCustomer] = useState<CustomerDetails>(emptyCustomer);

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
    () => Object.entries(cart).filter(([, line]) => line.quantity > 0),
    [cart],
  );
  const cartCount = cartLines.reduce((total, [, line]) => total + line.quantity * line.packQuantity, 0);
  const selectedProduct = catalog.products.find((product) => product.id === selectedProductId) ?? null;

  function openProduct(product: CatalogProduct) {
    setSelectedProductId(product.id);
    setPage("product");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function addToCart(product: CatalogProduct, packQuantity = product.packOptions[0]?.quantity ?? 1) {
    const availableQuantity = product.availableQuantity ?? 0;
    if (availableQuantity <= 0) {
      setOrderMessage(`${product.name} is currently out of stock.`);
      return;
    }
    setCart((current) => {
      const currentLine = current[product.id];
      const currentUnits = (currentLine?.quantity ?? 0) * (currentLine?.packQuantity ?? packQuantity);
      const nextUnits = Math.min(currentUnits + packQuantity, availableQuantity);
      return { ...current, [product.id]: { quantity: Math.max(1, Math.floor(nextUnits / packQuantity)), packQuantity } };
    });
    setOrderMessage(null);
  }
  function updateQuantity(productId: string, quantity: number) {
    setCart((current) => {
      const next = { ...current };
      if (quantity <= 0) delete next[productId];
      else {
        const available = catalog.products.find((product) => product.id === productId)?.availableQuantity ?? 0;
        const packQuantity = current[productId]?.packQuantity ?? 1;
        next[productId] = { quantity: Math.min(quantity, Math.max(Math.floor(available / packQuantity), 0)), packQuantity };
      }
      return next;
    });
  }
  function beginCheckout() {
    if (cartLines.length === 0) {
      setOrderMessage("Add at least one product before checkout.");
      return;
    }
    setPage(signedIn ? "checkout" : "login");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function submitOrder() {
    const lines: CustomerOrderLine[] = cartLines.map(([productId, line]) => ({ productId, quantity: line.quantity * line.packQuantity }));
    try {
      const result = await orderProvider.submitOrder({ lines, customer });
      setOrderMessage(`Order ${result.orderId} was submitted to the POS.`);
      setCart({});
      setPage("catalog");
    } catch (cause: unknown) {
      setOrderMessage(cause instanceof Error ? cause.message : "Unable to submit order.");
    }
  }

  if (!loading && !error && !catalog.ecommerce.isEnabled) {
    return <div className="app-shell centered-shell"><main className="entry-card"><p className="eyebrow">Retailer storefront</p><h1>Ordering is temporarily closed.</h1><p>The business owner has paused online ordering. Please try again later.</p><button className="text-button" type="button" onClick={onBack}>← Choose a different role</button></main></div>;
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <button className="brand brand-button" type="button" onClick={() => { setPage("catalog"); setSelectedProductId(null); }}>
          <span className="brand-mark">B</span><span><strong>Wholesale Hub</strong><small>Retailer storefront</small></span>
        </button>
        <div className="header-actions">
          {signedIn ? <button className="account-chip" type="button" onClick={() => setSignedIn(false)}>● {customer.contactName || "Account"} · Sign out</button> : <button className="outline-button" type="button" onClick={() => setPage("login")}>Sign in</button>}
          <button className="cart-button" type="button" onClick={() => document.getElementById("cart")?.scrollIntoView({ behavior: "smooth" })}>Cart <span>{cartCount}</span></button>
        </div>
      </header>
      <main>
        {page === "login" && <LoginPage onBack={() => setPage("catalog")} onSuccess={(details) => { setCustomer(details); setSignedIn(true); setPage("checkout"); }} />}
        {page === "checkout" && <CheckoutPage customer={customer} setCustomer={setCustomer} onBack={() => setPage("catalog")} onSubmit={submitOrder} message={orderMessage} />}
        {page === "product" && selectedProduct && <ProductPage product={selectedProduct} onBack={() => setPage("catalog")} onAdd={(packQuantity) => addToCart(selectedProduct, packQuantity)} />}
        {page === "catalog" && <CatalogPage catalog={catalog} products={products} query={query} setQuery={setQuery} categoryId={categoryId} setCategoryId={setCategoryId} loading={loading} error={error} onProduct={openProduct} onAdd={addToCart} />}
        {(page === "catalog" || page === "product") && (
          <section className="cart-section" id="cart" aria-labelledby="cart-heading">
            <div><p className="eyebrow">Your order</p><h2 id="cart-heading">Cart and checkout</h2></div>
            {cartLines.length === 0 ? <div className="state-card"><strong>Your cart is empty.</strong><p>Add products from the catalog to prepare an order for the POS.</p></div> : <div className="cart-card"><div className="cart-lines">{cartLines.map(([productId, line]) => { const product = catalog.products.find((item) => item.id === productId); if (!product) return null; return <div className="cart-line" key={productId}><div><strong>{product.name}</strong><small>{line.quantity} × {product.packOptions.find((option) => option.quantity === line.packQuantity)?.label ?? `${line.packQuantity} pack`} · {line.quantity * line.packQuantity} units</small></div><div className="quantity-control"><button type="button" onClick={() => updateQuantity(productId, line.quantity - 1)}>−</button><span>{line.quantity}</span><button type="button" onClick={() => updateQuantity(productId, line.quantity + 1)}>+</button></div></div>; })}</div><div className="checkout-row"><strong>{cartCount} unit{cartCount === 1 ? "" : "s"}</strong><button className="primary-button" type="button" onClick={beginCheckout}>Checkout</button></div>{orderMessage && <div className="inline-error" role="status">{orderMessage}</div>}</div>}
          </section>
        )}
      </main>
      <footer><span>Wholesale Hub</span><span>POS-owned catalog · Secure integration pending</span></footer>
    </div>
  );
}

function CatalogPage({ catalog, products, query, setQuery, categoryId, setCategoryId, loading, error, onProduct, onAdd }: {
  catalog: CatalogSnapshot; products: CatalogProduct[]; query: string; setQuery: (value: string) => void;
  categoryId: string; setCategoryId: (value: string) => void; loading: boolean; error: string | null;
  onProduct: (product: CatalogProduct) => void; onAdd: (product: CatalogProduct) => void;
}) {
  return <>
    <section className="hero"><div><p className="eyebrow">Wholesale ordering, simplified</p><h1>{catalog.ecommerce.bannerTitle}</h1><p className="hero-copy">{catalog.ecommerce.bannerSubtitle}</p></div><div className="hero-card"><span className="hero-card-label">For retailers</span><strong>Clear prices. Reliable stock.</strong><span>Order from the same catalog your supplier manages.</span></div></section>
    <section className="catalog-section" aria-labelledby="catalog-heading">
      <div className="section-heading"><div><p className="eyebrow">Product catalog</p><h2 id="catalog-heading">Find what you need</h2></div><label className="search-field"><span className="sr-only">Search products</span><input type="search" placeholder="Search products or SKU" value={query} onChange={(event) => setQuery(event.target.value)} /></label></div>
      <div className="category-row" aria-label="Product categories"><button className={categoryId === "all" ? "category active" : "category"} type="button" onClick={() => setCategoryId("all")}>All products</button>{catalog.categories.map((category) => <button className={categoryId === category.id ? "category active" : "category"} key={category.id} type="button" onClick={() => setCategoryId(category.id)}>{category.name}</button>)}</div>
      {loading && <div className="state-card">Loading approved catalog…</div>}
      {!loading && error && <div className="state-card error-state" role="alert"><strong>Catalog is not connected yet.</strong><p>{error}</p></div>}
      {!loading && !error && products.length === 0 && <div className="state-card"><strong>No products available.</strong><p>Connect the approved catalog source to display products.</p></div>}
      {!loading && !error && products.length > 0 && <div className="product-grid">{products.map((product) => {
        const outOfStock = product.availableQuantity !== null && product.availableQuantity <= 0;
        return <article className="product-card" key={product.id}><button className="product-card-link" type="button" onClick={() => onProduct(product)}><div className="product-image">{product.imageUrl ? <img src={product.imageUrl} alt={product.name} /> : <span>{product.name.slice(0, 1).toUpperCase()}</span>}</div><div className="product-details"><small>{product.brand ?? "Wholesale product"}</small><h3>{product.name}</h3><p>SKU {product.sku}</p><div className="product-footer"><strong>{outOfStock ? "Out of stock" : product.wholesalePrice === null ? "Price after sign in" : `${product.currency}${product.wholesalePrice.toFixed(2)}`}</strong><span className="view-link">View product →</span></div></div></button><button className="card-add-button" type="button" onClick={() => onAdd(product)} disabled={outOfStock}>{outOfStock ? "Unavailable" : "Add to cart"}</button></article>;
      })}</div>}
    </section>
  </>;
}

function ProductPage({ product, onBack, onAdd }: { product: CatalogProduct; onBack: () => void; onAdd: (packQuantity: number) => void }) {
  const images = product.imageUrls.length >= 2 ? product.imageUrls.slice(0, 5) : [product.imageUrl ?? "", product.imageUrl ?? ""];
  const [activeImage, setActiveImage] = useState(0);
  const [packQuantity, setPackQuantity] = useState(product.packOptions[0]?.quantity ?? 1);
  return <section className="product-page"><button className="back-link" type="button" onClick={onBack}>← Back to catalog</button><div className="product-layout"><div className="gallery"><div className="gallery-main">{images[activeImage] ? <img src={images[activeImage]} alt={`${product.name} view ${activeImage + 1}`} /> : <span>{product.name.slice(0, 1).toUpperCase()}</span>}</div><div className="gallery-thumbs">{images.map((image, index) => <button className={activeImage === index ? "gallery-thumb active" : "gallery-thumb"} type="button" key={`${image}-${index}`} onClick={() => setActiveImage(index)}>{image ? <img src={image} alt="" /> : <span>{index + 1}</span>}</button>)}</div></div><div className="product-copy"><p className="eyebrow">{product.brand ?? "Wholesale product"}</p><h1>{product.name}</h1><p className="product-price">{product.wholesalePrice === null ? "Sign in to see price" : `${product.currency}${(product.wholesalePrice * packQuantity).toFixed(2)}`} <small>per {product.packOptions.find((option) => option.quantity === packQuantity)?.label ?? "pack"}</small></p><p className="product-description-large">{product.description ?? "Reliable wholesale stock for your retail business."}</p><div className="pack-options"><strong>Choose your pack</strong><div>{product.packOptions.map((option) => <button className={packQuantity === option.quantity ? "pack-option active" : "pack-option"} type="button" key={option.quantity} onClick={() => setPackQuantity(option.quantity)}>{option.label}<small>{product.wholesalePrice === null ? "Price after sign in" : `${product.currency}${(product.wholesalePrice * option.quantity).toFixed(2)}`}</small></button>)}</div></div><div className="detail-list"><span>SKU <strong>{product.sku}</strong></span><span>Availability <strong>{product.availableQuantity === null ? "On request" : `${product.availableQuantity} units`}</strong></span></div><button className="primary-button wide-button" type="button" onClick={() => onAdd(packQuantity)} disabled={product.availableQuantity !== null && product.availableQuantity < packQuantity}>Add to cart</button></div></div></section>;
}

function LoginPage({ onBack, onSuccess }: { onBack: () => void; onSuccess: (details: CustomerDetails) => void }) {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState<string | null>(null);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.includes("@") || password.length < 6) { setError("Enter a valid email and a password with at least 6 characters."); return; }
    onSuccess({ ...emptyCustomer, email, contactName: email.split("@")[0] });
  }
  return <section className="form-page"><div className="form-card"><button className="back-link" type="button" onClick={onBack}>← Continue shopping</button><p className="eyebrow">Retail partner account</p><h1>Sign in to checkout</h1><p>Sign in to see your negotiated pricing and send orders to your supplier.</p><form onSubmit={submit}><label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Password<input type="password" minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>{error && <div className="inline-error" role="alert">{error}</div>}<button className="primary-button wide-button" type="submit">Sign in and continue</button></form><small className="form-note">Authentication will connect to the shared POS account service.</small></div></section>;
}

function CheckoutPage({ customer, setCustomer, onBack, onSubmit, message }: { customer: CustomerDetails; setCustomer: (value: CustomerDetails) => void; onBack: () => void; onSubmit: () => void; message: string | null }) {
  const [error, setError] = useState<string | null>(null);
  function update(field: keyof CustomerDetails, value: string) { setCustomer({ ...customer, [field]: value }); }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!customer.businessName || !customer.contactName || !customer.phone || !customer.address || !customer.city || !customer.state || !customer.postalCode) { setError("Complete all required business and delivery address fields."); return; } setError(null); onSubmit(); }
  return <section className="form-page"><div className="form-card checkout-form"><button className="back-link" type="button" onClick={onBack}>← Back to catalog</button><p className="eyebrow">Secure checkout</p><h1>Where should we deliver?</h1><p>Your supplier will use these details to prepare and deliver your order.</p><form onSubmit={submit}><div className="form-grid"><label>Business name *<input value={customer.businessName} onChange={(event) => update("businessName", event.target.value)} required /></label><label>Contact person *<input value={customer.contactName} onChange={(event) => update("contactName", event.target.value)} required /></label><label>Email<input type="email" value={customer.email} onChange={(event) => update("email", event.target.value)} /></label><label>Phone number *<input value={customer.phone} onChange={(event) => update("phone", event.target.value)} required /></label><label className="full-field">Delivery address *<input value={customer.address} onChange={(event) => update("address", event.target.value)} required /></label><label>City *<input value={customer.city} onChange={(event) => update("city", event.target.value)} required /></label><label>State *<input value={customer.state} onChange={(event) => update("state", event.target.value)} required /></label><label>Postal code *<input value={customer.postalCode} onChange={(event) => update("postalCode", event.target.value)} required /></label><label className="full-field">Delivery notes<textarea rows={3} value={customer.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Gate, timing, or packing instructions" /></label></div>{error && <div className="inline-error" role="alert">{error}</div>}{message && <div className="inline-error" role="status">{message}</div>}<button className="primary-button wide-button" type="submit">Review and place order</button></form></div></section>;
}
