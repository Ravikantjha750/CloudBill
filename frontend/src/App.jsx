import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  ReceiptText,
  ChartNoAxesCombined,
  Settings,
  Search,
  Sun,
  Moon,
  Bell,
  Plus,
  ArrowUpRight,
  Boxes,
  CircleAlert,
  Check,
  ChevronRight,
  Menu,
  X,
  RefreshCw,
  Wallet,
  Activity,
  Sparkles,
  LogOut,
} from "lucide-react";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
} from "framer-motion";
import toast, { Toaster } from "react-hot-toast";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";
import "./App.css";

const API_URL = "http://127.0.0.1:5000/api";

const navigation = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Point of Sale", icon: ShoppingCart },
  { label: "Products", icon: Package },
  { label: "Customers", icon: Users },
  { label: "Sales & Invoices", icon: ReceiptText },
  { label: "Inventory", icon: Boxes },
  { label: "Reports", icon: ChartNoAxesCombined },
];

const formatMoney = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

function getInitialTheme() {
  try {
    const saved = localStorage.getItem("cloudbill-theme");

    if (saved === "light" || saved === "dark") {
      return saved;
    }
  } catch {
    // Storage may be unavailable.
  }

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export default function App() {
  const [theme, setTheme] = useState(getInitialTheme);
  const [activePage, setActivePage] = useState("Dashboard");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]);
const [discount, setDiscount] = useState("0");
const [taxRate, setTaxRate] = useState("0");
  const [refreshing, setRefreshing] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const reduceMotion = useReducedMotion();

  const [form, setForm] = useState({
    name: "",
    sku: "",
    description: "",
    price: "",
    stock_quantity: "0",
    reorder_level: "5",
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;

    try {
      localStorage.setItem("cloudbill-theme", theme);
    } catch {
      // Theme still works for the current session.
    }
  }, [theme]);

  async function fetchProducts(isRefresh = false) {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const response = await fetch(`${API_URL}/products`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not load products.");
      }

      setProducts(data.products || []);
    } catch {
      setError(
        "Unable to connect to Flask. Make sure your backend is running."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchProducts();
  }, []);

  const totalUnits = products.reduce(
    (sum, p) => sum + Number(p.stock_quantity || 0),
    0
  );

  const inventoryValue = products.reduce(
    (sum, p) =>
      sum +
      Number(p.price || 0) * Number(p.stock_quantity || 0),
    0
  );

  const lowStock = products.filter(
    (p) => Number(p.stock_quantity) <= Number(p.reorder_level)
  );

  const outOfStock = products.filter(
    (p) => Number(p.stock_quantity) === 0
  );

  const stockChart = [
    {
      name: "In stock",
      value: products.filter(
        (p) => Number(p.stock_quantity) > Number(p.reorder_level)
      ).length,
      color: "#10a875",
    },
    {
      name: "Low stock",
      value: products.filter(
        (p) =>
          Number(p.stock_quantity) > 0 &&
          Number(p.stock_quantity) <= Number(p.reorder_level)
      ).length,
      color: "#e9a23b",
    },
    {
      name: "Out of stock",
      value: outOfStock.length,
      color: "#e56d68",
    },
  ].filter((item) => item.value > 0);

  const filteredProducts = useMemo(() => {
    const term = query.toLowerCase().trim();

    return products.filter(
      (p) =>
        String(p.name || "").toLowerCase().includes(term) ||
        String(p.sku || "").toLowerCase().includes(term)
    );
  }, [products, query]);

  function changePage(page) {
    setActivePage(page);
    setMobileMenu(false);
    setError("");
  }

  function updateForm(event) {
    setForm((previous) => ({
      ...previous,
      [event.target.name]: event.target.value,
    }));
  }

  async function submitProduct(event) {
    event.preventDefault();

    const price = Number(form.price);
    const stock = Number(form.stock_quantity);
    const reorder = Number(form.reorder_level);

    if (
      !form.name.trim() ||
      !form.sku.trim() ||
      form.price.trim() === "" ||
      !Number.isFinite(price) ||
      price < 0 ||
      !Number.isInteger(stock) ||
      stock < 0 ||
      !Number.isInteger(reorder) ||
      reorder < 0
    ) {
      toast.error("Please enter valid product details.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(`${API_URL}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          name: form.name.trim(),
          sku: form.sku.trim(),
          description: form.description.trim(),
          price,
          stock_quantity: stock,
          reorder_level: reorder,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not add product.");
      }

      toast.success("Product added successfully!");

      setForm({
        name: "",
        sku: "",
        description: "",
        price: "",
        stock_quantity: "0",
        reorder_level: "5",
      });

      setShowForm(false);
      await fetchProducts(true);
    } catch (err) {
      toast.error(err.message || "Could not add product.");
    } finally {
      setSaving(false);
    }
  }

  const pageVariants = {
    initial: reduceMotion
      ? { opacity: 1 }
      : { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: reduceMotion
      ? { opacity: 1 }
      : { opacity: 0, y: -5 },
  };
// Add product to cart
function addToCart(product) {
  const availableStock = Number(product.stock_quantity);

  if (availableStock <= 0) {
    toast.error("This product is out of stock.");
    return;
  }

  setCart((currentCart) => {
    const existing = currentCart.find(
      (item) => item.id === product.id
    );

    if (existing) {
      if (existing.quantity >= availableStock) {
        toast.error("Cannot exceed available stock.");
        return currentCart;
      }

      return currentCart.map((item) =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );
    }

    return [
      ...currentCart,
      {
        id: product.id,
        name: product.name,
        sku: product.sku,
        price: Number(product.price),
        quantity: 1,
        stock_quantity: availableStock,
      },
    ];
  });

  toast.success(`${product.name} added to cart`);
}

// Update quantity
function updateCartQuantity(productId, change) {
  setCart((currentCart) =>
    currentCart
      .map((item) => {
        if (item.id !== productId) {
          return item;
        }

        const nextQuantity = item.quantity + change;

        if (nextQuantity > item.stock_quantity) {
          toast.error("Cannot exceed available stock.");
          return item;
        }

        return {
          ...item,
          quantity: nextQuantity,
        };
      })
      .filter((item) => item.quantity > 0)
  );
}

// Remove product from cart
function removeFromCart(productId) {
  setCart((currentCart) =>
    currentCart.filter((item) => item.id !== productId)
  );
}

// Clear cart
function clearCart() {
  setCart([]);
  setDiscount("0");
}

// Clear cart
function clearCart() {
  setCart([]);
  setDiscount("0");
}

// Process checkout through the Flask API
async function handleCheckout() {
  if (cart.length === 0) {
    toast.error("Your cart is empty.");
    return;
  }

  if (checkoutLoading) return;

  // Convert the discount amount in rupees to a percentage
  const discountPercentage =
    cartSubtotal > 0
      ? (discountAmount / cartSubtotal) * 100
      : 0;

  setCheckoutLoading(true);

  try {
    const response = await fetch(`${API_URL}/sales/checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: cart.map((item) => ({
          product_id: Number(item.id),
          quantity: Number(item.quantity),
        })),
        discount: discountPercentage,
        tax_rate: validTaxRate,
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Checkout failed.");
    }

    toast.success(
      `Sale completed! Invoice: ${result.invoice_number}`
    );

    clearCart();
    setTaxRate("0");

    await fetchProducts(true);
  } catch (err) {
    console.error("Checkout failed:", err);
    toast.error(err.message || "Unable to complete checkout.");
  } finally {
    setCheckoutLoading(false);
  }
}

// Calculate subtotal


// Calculate subtotal
const cartSubtotal = cart.reduce(
  (sum, item) => sum + item.price * item.quantity,
  0
);

// Calculate discount
const discountAmount = Math.min(
  cartSubtotal,
  Math.max(0, Number(discount) || 0)
);

// Calculate taxable amount
const taxableAmount = cartSubtotal - discountAmount;

// Calculate tax
const validTaxRate = Math.min(
  100,
  Math.max(0, Number(taxRate) || 0)
);

const taxAmount = (taxableAmount * validTaxRate) / 100;

// Calculate final total
const cartTotal = taxableAmount + taxAmount;

// Calculate total product quantity
const cartItemCount = cart.reduce(
  (sum, item) => sum + item.quantity,
  0
);
  return (
    <div className="app-shell">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: "var(--surface)",
            color: "var(--text)",
            border: "1px solid var(--border)",
          },
        }}
      />

      {mobileMenu && (
        <button
          className="mobile-overlay"
          aria-label="Close navigation"
          onClick={() => setMobileMenu(false)}
        />
      )}

      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <a className="brand" href="#" onClick={(e) => e.preventDefault()}>
          <span className="brand-mark">
            <Activity size={23} strokeWidth={2.5} />
          </span>

          <span className="brand-copy">
            <strong>cloudbill<span>.</span></strong>
            <small>RETAIL INTELLIGENCE</small>
          </span>

          <button
            className="mobile-close icon-button"
            aria-label="Close menu"
            onClick={() => setMobileMenu(false)}
          >
            <X size={19} />
          </button>
        </a>

        <div className="workspace-label">WORKSPACE</div>

        <nav className="side-navigation" aria-label="Main navigation">
          {navigation.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={`nav-link ${
                activePage === label ? "nav-active" : ""
              }`}
              onClick={() => changePage(label)}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>

              {label === "Products" && (
                <span className="nav-count">{products.length}</span>
              )}

              {label === "Point of Sale" && (
                <span className="nav-beta">POS</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-spacer" />

        <div className="sidebar-promo">
          <div className="promo-orb">
            <Sparkles size={19} />
          </div>
          <strong>One place. Total control.</strong>
          <p>Your inventory, organized and ready for business.</p>
          <div className="promo-line">
            <span />
          </div>
          <small>CloudBill Workspace</small>
        </div>

        <button
          className={`nav-link settings-link ${
            activePage === "Settings" ? "nav-active" : ""
          }`}
          onClick={() => changePage("Settings")}
        >
          <Settings size={18} />
          <span>Settings</span>
        </button>

        <div className="sidebar-profile">
          <div className="profile-avatar">CB</div>
          <div className="profile-info">
            <strong>Store Admin</strong>
            <span>Administrator</span>
          </div>
          <span className="profile-status" title="Local development" />
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu-button"
              aria-label="Open navigation"
              onClick={() => setMobileMenu(true)}
            >
              <Menu size={20} />
            </button>

            <div className="breadcrumb">
              <span>Workspace</span>
              <ChevronRight size={13} />
              <strong>{activePage}</strong>
            </div>
          </div>

          <div className="topbar-actions">
            <label className="global-search">
              <Search size={17} />
              <input
                aria-label="Search products"
                placeholder="Search products..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => {
                  if (activePage !== "Products") {
                    setActivePage("Products");
                  }
                }}
              />
              <kbd>⌘ K</kbd>
            </label>

            <button
              className="icon-button theme-button"
              onClick={() =>
                setTheme((current) =>
                  current === "light" ? "dark" : "light"
                )
              }
              aria-label={`Switch to ${
                theme === "light" ? "dark" : "light"
              } mode`}
              title={`Switch to ${
                theme === "light" ? "dark" : "light"
              } mode`}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={theme}
                  initial={{ opacity: 0, rotate: -45, scale: 0.65 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  exit={{ opacity: 0, rotate: 45, scale: 0.65 }}
                  transition={{ duration: 0.2 }}
                  className="theme-icon"
                >
                  {theme === "light" ? (
                    <Moon size={19} />
                  ) : (
                    <Sun size={19} />
                  )}
                </motion.span>
              </AnimatePresence>
            </button>

            <button
              className="icon-button notification-button"
              aria-label="Notifications"
              title="Inventory alerts"
              onClick={() => changePage("Inventory")}
            >
              <Bell size={19} />
              {lowStock.length > 0 && (
                <span className="notification-dot" />
              )}
            </button>

            <div className="topbar-divider" />

            <div className="topbar-user">
              <div className="profile-avatar small-avatar">CB</div>
              <div>
                <strong>Store Admin</strong>
                <span>Workspace</span>
              </div>
            </div>
          </div>
        </header>

        <section className="page-content">
          {error && (
            <div className="connection-alert">
              <CircleAlert size={18} />
              <span>{error}</span>
              <button
                className="icon-button"
                onClick={() => fetchProducts(true)}
                aria-label="Retry connection"
              >
                <RefreshCw size={16} />
              </button>
            </div>
          )}

          <AnimatePresence mode="wait">
            {activePage === "Dashboard" && (
              <motion.div
                key="dashboard"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: reduceMotion ? 0 : 0.24 }}
              >
                <div className="hero-heading">
                  <div>
                    <div className="eyebrow">
                      <span className="eyebrow-dot" />
                      YOUR BUSINESS AT A GLANCE
                    </div>
                    <h1>
                      A clearer view of <span>your business.</span>
                    </h1>
                    <p>
                      Your inventory overview, all in one place.
                    </p>
                  </div>

                  <div className="hero-actions">
                    <button
                      className="secondary-button"
                      onClick={() => fetchProducts(true)}
                      disabled={refreshing}
                    >
                      <RefreshCw
                        size={16}
                        className={refreshing ? "spin-icon" : ""}
                      />
                      Refresh
                    </button>

                    <button
                      className="primary-button"
                      onClick={() => {
                        setActivePage("Products");
                        setShowForm(true);
                      }}
                    >
                      <Plus size={17} />
                      Add product
                    </button>
                  </div>
                </div>

                <div className="overview-strip">
                  <div className="overview-title">
                    <span className="overview-indicator" />
                    <span>INVENTORY OVERVIEW</span>
                  </div>
                  <span className="overview-caption">
                    {loading ? "Syncing data…" : "Live database data"}
                  </span>
                </div>

                <div className="stats-grid">
                  <StatCard
                    icon={Package}
                    label="Total products"
                    value={products.length}
                    detail="Products in your catalog"
                    tone="mint"
                    index={0}
                    reduceMotion={reduceMotion}
                  />

                  <StatCard
                    icon={Boxes}
                    label="Available units"
                    value={totalUnits.toLocaleString("en-IN")}
                    detail="Units across all products"
                    tone="blue"
                    index={1}
                    reduceMotion={reduceMotion}
                  />

                  <StatCard
                    icon={Wallet}
                    label="Inventory value"
                    value={formatMoney(inventoryValue)}
                    detail="At current selling prices"
                    tone="gold"
                    index={2}
                    reduceMotion={reduceMotion}
                  />

                  <StatCard
                    icon={CircleAlert}
                    label="Stock attention"
                    value={lowStock.length}
                    detail="Products at reorder level"
                    tone="coral"
                    index={3}
                    reduceMotion={reduceMotion}
                  />
                </div>

                <div className="dashboard-grid">
                  <section className="surface-panel product-panel">
                    <div className="panel-heading">
                      <div>
                        <span className="section-kicker">
                          YOUR CATALOG
                        </span>
                        <h2>Product inventory</h2>
                        <p>Keep track of the items you carry.</p>
                      </div>

                      <button
                        className="text-button"
                        onClick={() => changePage("Products")}
                      >
                        View inventory <ArrowUpRight size={16} />
                      </button>
                    </div>

                    <ProductTable
                      products={products.slice(0, 5)}
                      loading={loading}
                      onProducts={() => changePage("Products")}
                    />
                  </section>

                  <section className="surface-panel stock-panel">
                    <div className="panel-heading">
                      <div>
                        <span className="section-kicker">
                          INVENTORY HEALTH
                        </span>
                        <h2>Stock status</h2>
                        <p>Based on current stock levels.</p>
                      </div>
                      <span className="status-live">
                        <span />
                        LIVE
                      </span>
                    </div>

                    {loading ? (
                      <div className="chart-empty">Loading inventory…</div>
                    ) : products.length === 0 ? (
                     <div className="chart-empty">
  <div className="chart-empty-icon">
    <Boxes size={30} strokeWidth={1.7} />
  </div>

  <strong>No inventory yet</strong>

  <span>
    Add products to your catalog to see your inventory
    distribution and stock health here.
  </span>

  <button
    className="text-button"
    onClick={() => {
      setActivePage("Products");
      setShowForm(true);
    }}
  >
    Add your first product →
  </button>
</div>
                    ) : (
                      <>
                        <div className="chart-area">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={stockChart}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                innerRadius="62%"
                                outerRadius="84%"
                                paddingAngle={4}
                                stroke="none"
                                animationDuration={
                                  reduceMotion ? 0 : 700
                                }
                              >
                                {stockChart.map((item) => (
                                  <Cell
                                    key={item.name}
                                    fill={item.color}
                                  />
                                ))}
                              </Pie>
                              <Tooltip
                                formatter={(value, name) => [
                                  `${value} products`,
                                  name,
                                ]}
                                contentStyle={{
                                  background: "var(--surface)",
                                  border: "1px solid var(--border)",
                                  borderRadius: 12,
                                  color: "var(--text)",
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>

                          <div className="chart-center">
                            <strong>{products.length}</strong>
                            <span>PRODUCTS</span>
                          </div>
                        </div>

                        <div className="chart-legend">
                          {[
                            {
                              label: "In stock",
                              value: stockChart.find(
                                (x) => x.name === "In stock"
                              )?.value || 0,
                              color: "#10a875",
                            },
                            {
                              label: "Low stock",
                              value: stockChart.find(
                                (x) => x.name === "Low stock"
                              )?.value || 0,
                              color: "#e9a23b",
                            },
                            {
                              label: "Out of stock",
                              value: outOfStock.length,
                              color: "#e56d68",
                            },
                          ].map((item) => (
                            <div
                              className="legend-item"
                              key={item.label}
                            >
                              <span
                                className="legend-dot"
                                style={{ background: item.color }}
                              />
                              <span>{item.label}</span>
                              <strong>{item.value}</strong>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </section>
                </div>

                <section className="surface-panel attention-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="section-kicker">
                        REQUIRES ATTENTION
                      </span>
                      <h2>Stock alerts</h2>
                      <p>
                        Products that may need replenishment.
                      </p>
                    </div>

                    <span className="alert-count">
                      {lowStock.length} ITEMS
                    </span>
                  </div>

                  {loading ? (
                    <div className="empty-state">Checking stock levels…</div>
                  ) : lowStock.length === 0 ? (
                    <div className="healthy-state">
                      <span className="healthy-icon">
                        <Check size={19} />
                      </span>
                      <div>
                        <strong>Everything looks good</strong>
                        <p>
                          No products are currently at or below their
                          reorder levels.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="alert-items">
                      {lowStock.slice(0, 5).map((product) => (
                        <div
                          className="alert-item"
                          key={product.id}
                        >
                          <div className="alert-product-icon">
                            <Package size={18} />
                          </div>
                          <div className="alert-product-info">
                            <strong>{product.name}</strong>
                            <span>{product.sku}</span>
                          </div>
                          <span
                            className={`stock-pill ${
                              Number(product.stock_quantity) === 0
                                ? "stock-empty"
                                : "stock-low"
                            }`}
                          >
                            {Number(product.stock_quantity) === 0
                              ? "Out of stock"
                              : `${product.stock_quantity} left`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </motion.div>
            )}

            {activePage === "Products" && (
              <motion.div
                key="products"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: reduceMotion ? 0 : 0.24 }}
              >
                <div className="hero-heading">
                  <div>
                    <div className="eyebrow">
                      <span className="eyebrow-dot" />
                      INVENTORY MANAGEMENT
                    </div>
                    <h1>
                      Products <span>& inventory.</span>
                    </h1>
                    <p>
                      Manage your catalog, prices, and stock levels.
                    </p>
                  </div>

                  <div className="hero-actions">
                    <button
                      className="secondary-button"
                      onClick={() => fetchProducts(true)}
                      disabled={refreshing}
                    >
                      <RefreshCw
                        size={16}
                        className={refreshing ? "spin-icon" : ""}
                      />
                      Refresh
                    </button>

                    <button
                      className="primary-button"
                      onClick={() => setShowForm((value) => !value)}
                    >
                      <Plus size={17} />
                      Add product
                    </button>
                  </div>
                </div>

                {showForm && (
                  <motion.section
                    className="surface-panel add-form-panel"
                    initial={
                      reduceMotion
                        ? { opacity: 1 }
                        : { opacity: 0, height: 0 }
                    }
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <div className="panel-heading">
                      <div>
                        <span className="section-kicker">
                          NEW INVENTORY ITEM
                        </span>
                        <h2>Add a product</h2>
                      </div>
                      <button
                        className="icon-button"
                        onClick={() => setShowForm(false)}
                        aria-label="Close product form"
                      >
                        <X size={19} />
                      </button>
                    </div>

                    <form
                      className="product-form"
                      onSubmit={submitProduct}
                    >
                      <label>
                        Product name *
                        <input
                          name="name"
                          value={form.name}
                          onChange={updateForm}
                          placeholder="e.g. Wireless Mouse"
                          required
                        />
                      </label>

                      <label>
                        SKU *
                        <input
                          name="sku"
                          value={form.sku}
                          onChange={updateForm}
                          placeholder="e.g. MOUSE-002"
                          required
                        />
                      </label>

                      <label>
                        Price (₹) *
                        <input
                          type="number"
                          name="price"
                          min="0"
                          step="0.01"
                          value={form.price}
                          onChange={updateForm}
                          placeholder="599.00"
                          required
                        />
                      </label>

                      <label>
                        Initial stock *
                        <input
                          type="number"
                          name="stock_quantity"
                          min="0"
                          step="1"
                          value={form.stock_quantity}
                          onChange={updateForm}
                          required
                        />
                      </label>

                      <label>
                        Reorder level *
                        <input
                          type="number"
                          name="reorder_level"
                          min="0"
                          step="1"
                          value={form.reorder_level}
                          onChange={updateForm}
                          required
                        />
                      </label>

                      <label className="form-full">
                        Description
                        <textarea
                          name="description"
                          value={form.description}
                          onChange={updateForm}
                          placeholder="Describe this product…"
                          rows="2"
                        />
                      </label>

                      <div className="form-actions form-full">
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => setShowForm(false)}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="primary-button"
                          disabled={saving}
                        >
                          {saving ? (
                            <>
                              <RefreshCw
                                size={16}
                                className="spin-icon"
                              />
                              Saving…
                            </>
                          ) : (
                            <>
                              <Plus size={16} />
                              Save product
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </motion.section>
                )}

                <div className="stats-grid compact-stats">
                  <StatCard
                    icon={Package}
                    label="Products"
                    value={products.length}
                    tone="mint"
                    index={0}
                    reduceMotion={reduceMotion}
                  />
                  <StatCard
                    icon={Boxes}
                    label="Total units"
                    value={totalUnits.toLocaleString("en-IN")}
                    tone="blue"
                    index={1}
                    reduceMotion={reduceMotion}
                  />
                  <StatCard
                    icon={CircleAlert}
                    label="Low stock"
                    value={lowStock.length}
                    tone="coral"
                    index={2}
                    reduceMotion={reduceMotion}
                  />
                  <StatCard
                    icon={Wallet}
                    label="Inventory value"
                    value={formatMoney(inventoryValue)}
                    tone="gold"
                    index={3}
                    reduceMotion={reduceMotion}
                  />
                </div>

                <section className="surface-panel product-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="section-kicker">
                        PRODUCT DIRECTORY
                      </span>
                      <h2>All products</h2>
                      <p>
                        {filteredProducts.length} matching products
                      </p>
                    </div>

                    <label className="table-search">
                      <Search size={16} />
                      <input
                        placeholder="Search name or SKU"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </label>
                  </div>

                  <ProductTable
                    products={filteredProducts}
                    loading={loading}
                    onProducts={() => fetchProducts(true)}
                  />
                </section>
              </motion.div>
            )}

           {activePage === "Point of Sale" ? (
  <motion.div
    key="pos"
    variants={pageVariants}
    initial="initial"
    animate="animate"
    exit="exit"
    transition={{ duration: reduceMotion ? 0 : 0.24 }}
  >
    <div className="hero-heading">
      <div>
        <div className="eyebrow">
          <span className="eyebrow-dot" />
          RETAIL CHECKOUT
        </div>

        <h1>
          Point of <span>Sale.</span>
        </h1>

        <p>Select products and prepare a customer bill.</p>
      </div>

      <div className="hero-actions">
        <button
          className="secondary-button"
          onClick={() => fetchProducts(true)}
          disabled={refreshing}
        >
          <RefreshCw
            size={16}
            className={refreshing ? "spin-icon" : ""}
          />
          Refresh products
        </button>
      </div>
    </div>

    <div className="pos-layout">
      <section className="surface-panel pos-products">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">PRODUCT CATALOG</span>
            <h2>Select products</h2>
            <p>{products.length} products available in inventory</p>
          </div>
        </div>

        <label className="table-search pos-search">
          <Search size={16} />

          <input
            placeholder="Search product name or SKU"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        {loading ? (
          <div className="loading-state">
            <RefreshCw size={20} className="spin-icon" />
            <span>Loading products...</span>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="empty-state">
            <Package size={30} />
            <strong>No products available</strong>
            <p>Add a product or change your search.</p>

            <button
              className="primary-button"
              onClick={() => {
                setActivePage("Products");
                setShowForm(true);
              }}
            >
              <Plus size={16} />
              Add product
            </button>
          </div>
        ) : (
          <div className="pos-product-grid">
            {filteredProducts.map((product) => {
              const stock = Number(product.stock_quantity || 0);

              return (
                <article className="pos-product-card" key={product.id}>
                  <div className="pos-product-icon">
                    <Package size={22} />
                  </div>

                  <div className="pos-product-details">
                    <strong>{product.name}</strong>
                    <span>{product.sku}</span>
                  </div>

                  <div className="pos-product-bottom">
                    <strong>{formatMoney(product.price)}</strong>

                    <span>
                      {stock > 0 ? `${stock} in stock` : "Out of stock"}
                    </span>
                  </div>

                  <button
                    className="pos-add-button"
                    aria-label={`Add ${product.name} to cart`}
                    title="Add to cart"
                    disabled={stock <= 0}
                    onClick={() => addToCart(product)}
                  >
                    <Plus size={17} />
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <aside className="surface-panel pos-cart">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">CURRENT ORDER</span>
            <h2>Shopping cart</h2>
            <p>{cartItemCount} items in this order</p>
          </div>

          {cart.length > 0 && (
            <button
              className="text-button"
              onClick={clearCart}
            >
              Clear
            </button>
          )}
        </div>

        {cart.length === 0 ? (
          <div className="cart-empty">
            <div className="cart-empty-icon">
              <ShoppingCart size={27} />
            </div>

            <strong>Your cart is empty</strong>

            <p>
              Select a product from the catalog to start preparing a bill.
            </p>
          </div>
        ) : (
          <>
            <div className="cart-items">
              {cart.map((item) => (
                <div className="cart-item" key={item.id}>
                  <div className="cart-item-info">
                    <strong>{item.name}</strong>
                    <span>{item.sku}</span>
                    <span>{formatMoney(item.price)} each</span>
                  </div>

                  <div className="cart-item-controls">
                    <div className="quantity-controls">
                      <button
                        type="button"
                        aria-label={`Decrease ${item.name} quantity`}
                        onClick={() => updateCartQuantity(item.id, -1)}
                      >
                        −
                      </button>

                      <span>{item.quantity}</span>

                      <button
                        type="button"
                        aria-label={`Increase ${item.name} quantity`}
                        disabled={item.quantity >= item.stock_quantity}
                        onClick={() => updateCartQuantity(item.id, 1)}
                      >
                        +
                      </button>
                    </div>

                    <strong>
                      {formatMoney(item.price * item.quantity)}
                    </strong>

                    <button
                      type="button"
                      className="remove-cart-item"
                      onClick={() => removeFromCart(item.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="cart-adjustment">
              <label>
                Discount (₹)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  max={cartSubtotal}
                  value={discount}
                  onChange={(event) => setDiscount(event.target.value)}
                />
              </label>

              <label>
                Tax (%)
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={taxRate}
                  onChange={(event) => setTaxRate(event.target.value)}
                />
              </label>
            </div>

            <div className="cart-summary">
              <div>
                <span>Subtotal</span>
                <strong>{formatMoney(cartSubtotal)}</strong>
              </div>

              <div>
                <span>Discount</span>
                <strong>− {formatMoney(discountAmount)}</strong>
              </div>

              <div>
                <span>Tax ({validTaxRate}%)</span>
                <strong>{formatMoney(taxAmount)}</strong>
              </div>

              <div className="cart-total">
                <span>Total due</span>
                <strong>{formatMoney(cartTotal)}</strong>
              </div>
            </div>

            ```jsx
<button
  type="button"
  className="primary-button checkout-button"
  onClick={handleCheckout}
  disabled={checkoutLoading || cart.length === 0}
>
  <ShoppingCart size={17} />
  {checkoutLoading ? "Processing..." : "Proceed to checkout"}
  <span>{formatMoney(cartTotal)}</span>
</button>
```

          </>
        )}
      </aside>
    </div>
  </motion.div>

) : activePage !== "Dashboard" &&
  activePage !== "Products" && (
    <motion.div
      key={activePage}
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: reduceMotion ? 0 : 0.24 }}
    >
      <div className="hero-heading">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-dot" />
            CLOUD BILL WORKSPACE
          </div>

          <h1>
            {activePage}
            <span>.</span>
          </h1>

          <p>
            This module will be connected to the backend as
            we implement the application.
          </p>
        </div>
      </div>

      <section className="surface-panel module-placeholder">
        <div className="module-icon">
          {activePage === "Customers" ? (
            <Users size={29} />
          ) : activePage === "Sales & Invoices" ? (
            <ReceiptText size={29} />
          ) : activePage === "Inventory" ? (
            <Boxes size={29} />
          ) : activePage === "Reports" ? (
            <ChartNoAxesCombined size={29} />
          ) : (
            <Settings size={29} />
          )}
        </div>

        <h2>{activePage}</h2>

        <p>
          {activePage === "Customers"
            ? "Customer profiles and purchase history will be connected to the customers API."
            : activePage === "Sales & Invoices"
              ? "Sales history and printable invoices will be connected after billing is implemented."
              : activePage === "Inventory"
                ? "Stock movements, adjustments, and inventory alerts will be developed using the existing database."
                : activePage === "Reports"
                  ? "Sales and revenue reports will use actual transaction data once the sales module is implemented."
                  : "Store settings and account preferences will be added in a later phase."}
        </p>

        <span className="module-badge">
          <Sparkles size={14} />
          Development roadmap
        </span>
      </section>
    </motion.div>
  )}
          </AnimatePresence>

          <footer className="page-footer">
            <span>
              <span className="footer-status" />
              CloudBill <span className="footer-version">v0.2</span>
            </span>
            <span>Built for better retail management.</span>
          </footer>
        </section>
      </main>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
  index,
  reduceMotion,
}) {
  return (
    <motion.article
      className="stat-card"
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reduceMotion ? 0 : 0.35,
        delay: reduceMotion ? 0 : index * 0.07,
      }}
      whileHover={reduceMotion ? undefined : { y: -3 }}
    >
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        <span className={`stat-icon ${tone}`}>
          <Icon size={19} strokeWidth={1.8} />
        </span>
      </div>

      <div className="stat-value">{value}</div>

      <div className="stat-detail">
        <span className="detail-dot" />
        {detail || "Current database value"}
      </div>
    </motion.article>
  );
}

function ProductTable({ products, loading, onProducts }) {
  if (loading) {
    return (
      <div className="loading-state">
        <RefreshCw size={20} className="spin-icon" />
        <span>Loading your inventory…</span>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="empty-state">
        <Package size={30} />
        <strong>No products found</strong>
        <p>Add products or change your search.</p>
      </div>
    );
  }

  return (
    <div className="table-scroll">
      <table className="product-table">
        <thead>
          <tr>
            <th>PRODUCT</th>
            <th>SKU</th>
            <th>PRICE</th>
            <th>QUANTITY</th>
            <th>STATUS</th>
          </tr>
        </thead>

        <tbody>
          {products.map((product, index) => {
            const stock = Number(product.stock_quantity || 0);
            const reorder = Number(product.reorder_level || 0);

            const status =
              stock === 0
                ? "Out of stock"
                : stock <= reorder
                  ? "Low stock"
                  : "In stock";

            const statusClass =
              stock === 0
                ? "empty"
                : stock <= reorder
                  ? "low"
                  : "good";

            return (
              <motion.tr
                key={product.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: Math.min(index * 0.035, 0.2) }}
              >
                <td>
                  <div className="product-name-cell">
                    <div className="product-initial">
                      {String(product.name || "?")
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                    <div>
                      <strong>{product.name}</strong>
                      <span>
                        {product.category_name || "General"}
                      </span>
                    </div>
                  </div>
                </td>

                <td className="sku-cell">{product.sku}</td>

                <td className="price-cell">
                  {formatMoney(product.price)}
                </td>

                <td>
                  <span className="quantity-cell">{stock}</span>
                </td>

                <td>
                  <span className={`stock-pill ${statusClass}`}>
                    <span />
                    {status}
                  </span>
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>

      <div className="table-bottom">
        <span>Inventory synchronized with your database</span>
        <button className="icon-button" onClick={onProducts}>
          <RefreshCw size={15} />
        </button>
      </div>
    </div>
  );
}