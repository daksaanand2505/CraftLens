import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Layers,
  Mic,
  Package,
  Paperclip,
  Plus,
  RefreshCw,
  Sparkles,
  Store,
  TrendingUp
} from "lucide-react";
import { getProducts, getMaterials, getOrders, getInventory } from "../services/craftlensApi";
import { formatCurrency } from "../utils/formatters";

function Dashboard({ navigateTo }) {
  const [products, setProducts] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [orders, setOrders] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [promptText, setPromptText] = useState("");

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError("");

      const [prodRes, matRes, ordRes, invRes] = await Promise.allSettled([
        getProducts(),
        getMaterials(),
        getOrders(),
        getInventory()
      ]);

      setProducts(prodRes.status === "fulfilled" ? prodRes.value.products || [] : []);
      setMaterials(matRes.status === "fulfilled" ? matRes.value.materials || [] : []);
      setOrders(ordRes.status === "fulfilled" ? ordRes.value.orders || [] : []);
      setInventory(invRes.status === "fulfilled" ? invRes.value.inventory || [] : []);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      setError("Could not load studio data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Strict calculations from actual backend data
  const publishedProducts = products.filter(
    (p) => (p.status || "").toLowerCase() === "published"
  );
  const lowStockMaterials = materials.filter(
    (m) => Number(m.quantity) <= Number(m.minimumStockLevel || 0)
  );
  const totalRevenue = orders.reduce(
    (sum, o) => sum + Number(o.totalAmount || o.price || 0),
    0
  );

  // 4 Deterministic Stat Cards
  const stats = [
    {
      id: "stat-1",
      title: "Total Creations",
      value: String(products.length),
      metricUnit: products.length === 1 ? "creation" : "creations",
      trend: publishedProducts.length > 0 ? `${publishedProducts.length} published` : "0 live",
      trendText: "in catalogue",
      isPositive: products.length > 0,
      icon: Store,
      accentBg: "#ECFDF5",
      accentColor: "#059669"
    },
    {
      id: "stat-2",
      title: "Total Orders",
      value: String(orders.length),
      metricUnit: orders.length === 1 ? "order" : "orders",
      trend: orders.length === 0 ? "0 orders" : `${orders.length} active`,
      trendText: orders.length === 0 ? "no sales yet" : "recorded",
      isPositive: orders.length > 0,
      icon: Layers,
      accentBg: "#EFF6FF",
      accentColor: "#2563EB"
    },
    {
      id: "stat-3",
      title: "Raw Materials",
      value: String(materials.length),
      metricUnit: "tracked",
      trend: lowStockMaterials.length === 0 ? "All healthy" : `${lowStockMaterials.length} low`,
      trendText: lowStockMaterials.length === 0 ? "in stock" : "needs restock",
      isPositive: lowStockMaterials.length === 0,
      icon: lowStockMaterials.length > 0 ? AlertTriangle : Package,
      accentBg: lowStockMaterials.length > 0 ? "#FFFBEB" : "#F0FDF4",
      accentColor: lowStockMaterials.length > 0 ? "#D97706" : "#16A34A"
    },
    {
      id: "stat-4",
      title: "Store Revenue",
      value: formatCurrency(totalRevenue),
      metricUnit: "total",
      trend: orders.length === 0 ? "₹0 recorded" : "from orders",
      trendText: orders.length === 0 ? "no sales yet" : `${orders.length} orders`,
      isPositive: orders.length > 0,
      icon: TrendingUp,
      accentBg: "#F0FDF4",
      accentColor: "#16A34A"
    }
  ];

  const handlePromptSubmit = (e) => {
    e?.preventDefault();
    navigateTo("create");
  };

  return (
    <div className="dashboard-content-page">
      {/* 1. Page Header with Title & Action */}
      <div className="dashboard-page-header">
        <div className="header-text-cluster">
          <div className="header-greeting-row">
            <h1>Studio Dashboard</h1>
            <span className="live-studio-badge">
              <span className="live-dot" />
              Store Connected
            </span>
          </div>
          <p className="header-supporting-text">
            Workshop overview for Anita Crafts. Real-time metrics from your store database.
          </p>
        </div>

        <div className="header-action-cluster">
          <button
            className="secondary-action-btn"
            onClick={loadDashboardData}
            disabled={loading}
            type="button"
            title="Refresh database records"
          >
            <RefreshCw size={14} className={loading ? "spin" : ""} />
            <span>Refresh</span>
          </button>

          <button
            className="primary-action-btn"
            onClick={() => navigateTo("create")}
            type="button"
          >
            <Plus size={16} />
            <span>+ Create Product</span>
          </button>
        </div>
      </div>

      {/* 2. Four Summary Stat Cards Grid */}
      <div className="dashboard-stats-grid">
        {stats.map((item) => {
          const Icon = item.icon;
          return (
            <div className="stat-metric-card" key={item.id}>
              <div className="stat-card-topbar">
                <span className="stat-card-label">{item.title}</span>
                <div
                  className="stat-icon-wrapper"
                  style={{ backgroundColor: item.accentBg, color: item.accentColor }}
                >
                  <Icon size={17} />
                </div>
              </div>

              <div className="stat-card-body">
                <div className="stat-value-row">
                  <span className="stat-number">{item.value}</span>
                  <span className="stat-unit">{item.metricUnit}</span>
                </div>

                <div className="stat-trend-footer">
                  <span
                    className={"trend-badge " + (item.isPositive ? "positive" : "warning")}
                  >
                    {item.trend}
                  </span>
                  <span className="trend-context">{item.trendText}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Main Dashboard 2-Column Grid */}
      <div className="dashboard-main-columns-grid">
        {/* LEFT COLUMN: Recent Creations Table + AI Co-Pilot Card */}
        <div className="dashboard-left-column">
          {/* Recent Store Creations (Real Products from Backend) */}
          <div className="dashboard-section-card">
            <div className="section-card-header">
              <div>
                <h2>Recent Store Creations</h2>
                <p>Saved handcrafted listings from your catalogue repository</p>
              </div>

              <button
                className="section-ghost-link"
                onClick={() => navigateTo("catalogue")}
                type="button"
              >
                <span>View all ({products.length})</span>
                <ArrowRight size={14} />
              </button>
            </div>

            {loading ? (
              <div className="table-loading-state">
                <p>Loading creations from repository...</p>
              </div>
            ) : products.length === 0 ? (
              <div className="dashboard-empty-card">
                <div className="empty-icon-wrap">
                  <Store size={28} />
                </div>
                <h3>No creations saved yet</h3>
                <p>Use the voice-first AI workflow to add your first handcrafted product.</p>
                <button
                  className="primary-button compact-btn"
                  onClick={() => navigateTo("create")}
                  type="button"
                >
                  <Plus size={14} />
                  <span>Create first product</span>
                </button>
              </div>
            ) : (
              <div className="batches-table-container">
                <table className="batches-table">
                  <thead>
                    <tr>
                      <th>Product Title</th>
                      <th>Category</th>
                      <th>Creation Date</th>
                      <th>Status</th>
                      <th>Recommended Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.slice(0, 6).map((product) => {
                      const profile = product.productProfile || product;
                      const price =
                        product.pricing?.recommendedPrice || product.price || 0;
                      const createdDate = product.createdAt
                        ? new Date(product.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short"
                          })
                        : "Recent";

                      return (
                        <tr key={product.id} className="batch-row">
                          <td className="craft-title-cell">
                            <strong>{profile.title || "Handcrafted Item"}</strong>
                            <span className="artisan-lead">
                              {profile.materials ? String(profile.materials).split(",")[0] : "Handmade"}
                            </span>
                          </td>
                          <td>
                            <span className="category-subtle-badge">
                              {profile.category || "Craft"}
                            </span>
                          </td>
                          <td className="due-cell">
                            <Clock size={12} />
                            <span>{createdDate}</span>
                          </td>
                          <td>
                            <span className="stage-status-pill pill-active">
                              {product.status || "Published"}
                            </span>
                          </td>
                          <td className="price-cell">
                            <strong>{price > 0 ? formatCurrency(price) : "₹0"}</strong>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* CraftLens AI Studio Co-Pilot Prompt Card */}
          <div className="dashboard-section-card ai-copilot-card">
            <div className="ai-card-header">
              <div className="ai-header-left">
                <div className="ai-sparkle-pill">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h3>CraftLens AI Co-Pilot</h3>
                  <p>Voice and image intelligence for your handicraft listings</p>
                </div>
              </div>

              <div className="ai-quick-tags">
                <button
                  className="ai-tag-chip"
                  onClick={() => navigateTo("create")}
                  type="button"
                >
                  <Plus size={12} />
                  <span>Create Listing</span>
                </button>
                <button
                  className="ai-tag-chip"
                  onClick={() => navigateTo("create")}
                  type="button"
                >
                  <Mic size={12} />
                  <span>Voice Story</span>
                </button>
              </div>
            </div>

            <form className="ai-chat-input-form" onSubmit={handlePromptSubmit}>
              <input
                type="text"
                placeholder="Ask CraftLens: 'Start new craft listing' or describe what you made..."
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                className="ai-chat-input"
              />

              <div className="ai-form-bottom-bar">
                <div className="ai-input-tools">
                  <button
                    type="button"
                    className="ai-tool-btn"
                    title="Upload product photo"
                    onClick={() => navigateTo("create")}
                  >
                    <Paperclip size={14} />
                    <span>Attach Photo</span>
                  </button>

                  <button
                    type="button"
                    className="ai-tool-btn mic-btn"
                    title="Record product voice story"
                    onClick={() => navigateTo("create")}
                  >
                    <Mic size={14} />
                    <span>Voice Story</span>
                  </button>
                </div>

                <button type="submit" className="ai-submit-btn">
                  <span>Start Creation</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* RIGHT COLUMN: Real Materials Stock + Workshop Info */}
        <div className="dashboard-right-column">
          {/* Raw Materials Inventory Progress Card (From GET /api/materials) */}
          <div className="dashboard-section-card">
            <div className="section-card-header">
              <div>
                <h2>Raw Materials Stock</h2>
                <p>Workshop supplies from database</p>
              </div>

              <button
                className="section-ghost-link"
                onClick={loadDashboardData}
                type="button"
              >
                <span>Sync</span>
              </button>
            </div>

            {loading ? (
              <div className="table-loading-state">
                <p>Loading materials...</p>
              </div>
            ) : materials.length === 0 ? (
              <div className="dashboard-empty-card compact">
                <p>No raw materials registered in workshop yet.</p>
              </div>
            ) : (
              <div className="materials-stock-list">
                {materials.map((mat) => {
                  const qty = Number(mat.quantity) || 0;
                  const min = Number(mat.minimumStockLevel) || 1;
                  const isLow = qty <= min;
                  const percent = Math.min(100, Math.round((qty / (min * 4)) * 100));

                  return (
                    <div className="material-stock-item" key={mat.id}>
                      <div className="material-item-top">
                        <div>
                          <strong className="mat-name">{mat.name}</strong>
                          <span className="mat-qty">
                            {qty} {mat.unit || "units"} available (min {min} {mat.unit})
                          </span>
                        </div>

                        <span
                          className={
                            "mat-badge " + (isLow ? "status-low" : "status-healthy")
                          }
                        >
                          {isLow ? "Low Stock" : "In Stock"}
                        </span>
                      </div>

                      <div className="material-progress-track">
                        <div
                          className={
                            "material-progress-bar " +
                            (isLow ? "bar-danger" : percent < 50 ? "bar-warn" : "bar-good")
                          }
                          style={{ width: Math.max(8, percent) + "%" }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="materials-card-footer">
              <span className="materials-footnote">
                {lowStockMaterials.length === 0
                  ? "✓ All workshop material levels are above minimum threshold."
                  : `⚠️ ${lowStockMaterials.length} material is currently at or below minimum threshold.`}
              </span>
            </div>
          </div>

          {/* Workshop Profile Card (From Artisans Schema) */}
          <div className="dashboard-section-card">
            <div className="section-card-header">
              <div>
                <h2>Artisan Workshop</h2>
                <p>Registered artisan profile</p>
              </div>
            </div>

            <div className="workshop-info-box">
              <div className="workshop-profile-row">
                <div className="workshop-avatar-square">🧺</div>
                <div className="workshop-meta">
                  <strong>Anita Crafts</strong>
                  <span>Tamil Nadu, India</span>
                  <span className="workshop-lang-pill">Primary: Tamil · English</span>
                </div>
              </div>

              <div className="workshop-metrics-mini">
                <div className="mini-metric">
                  <span className="mini-label">Catalogue Items</span>
                  <strong>{products.length}</strong>
                </div>
                <div className="mini-metric">
                  <span className="mini-label">Completed Sales</span>
                  <strong>{orders.length}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
