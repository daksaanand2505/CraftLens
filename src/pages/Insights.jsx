import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Package,
  Plus,
  RefreshCw,
  Sparkles,
  Store,
  TrendingUp
} from "lucide-react";
import PageHeader from "../components/PageHeader";
import { getProducts, getMaterials, getOrders } from "../services/craftlensApi";
import { formatCurrency } from "../utils/formatters";

function Insights({ navigateTo }) {
  const [products, setProducts] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [prodRes, matRes, ordRes] = await Promise.allSettled([
        getProducts(),
        getMaterials(),
        getOrders()
      ]);

      setProducts(prodRes.status === "fulfilled" ? prodRes.value.products || [] : []);
      setMaterials(matRes.status === "fulfilled" ? matRes.value.materials || [] : []);
      setOrders(ordRes.status === "fulfilled" ? ordRes.value.orders || [] : []);
    } catch (err) {
      console.error("Insights loading error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const lowStockMaterials = materials.filter(
    (m) => Number(m.quantity) <= Number(m.minimumStockLevel || 0)
  );
  const lowStockCount = lowStockMaterials.length;

  const totalRevenue = orders.reduce(
    (sum, o) => sum + Number(o.totalAmount || o.price || 0),
    0
  );

  const totalQuantitySold = orders.reduce(
    (sum, o) => sum + Number(o.quantity || 1),
    0
  );

  const averageOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0;

  // Group orders by product to identify top seller
  const productSalesMap = {};
  orders.forEach((o) => {
    const key = o.productTitle || o.productId || "Handcrafted Product";
    if (!productSalesMap[key]) {
      productSalesMap[key] = { count: 0, revenue: 0 };
    }
    productSalesMap[key].count += Number(o.quantity || 1);
    productSalesMap[key].revenue += Number(o.totalAmount || o.price || 0);
  });

  const sortedSales = Object.entries(productSalesMap).sort(
    (a, b) => b[1].count - a[1].count
  );
  const topSeller = sortedSales.length > 0 ? sortedSales[0] : null;

  return (
    <div className="insights-page">
      <PageHeader
        eyebrow="CRAFTLENS INTELLIGENCE"
        title="Store Telemetry & Insights"
        description="Data synthesized from your actual store listings, order velocity, and workshop materials."
      />

      {/* Intelligence Status Banner */}
      <div className="insights-summary-card">
        <div className="summary-left">
          <div className="summary-icon-box">
            <Sparkles size={20} />
          </div>
          <div>
            <span className="section-kicker">
              {orders.length === 0 ? "EARLY STORE PHASE" : "ACTIVE STORE TELEMETRY"}
            </span>
            <h2>
              {orders.length === 0
                ? "Awaiting first customer orders"
                : `${orders.length} order${orders.length === 1 ? "" : "s"} recorded in store (${totalQuantitySold} unit${totalQuantitySold === 1 ? "" : "s"} sold)`}
            </h2>
            <p>
              {orders.length === 0
                ? "CraftLens will automatically generate sales velocity and pricing trends as your store records customer transactions."
                : `Total store revenue generated to date: ${formatCurrency(totalRevenue)} across ${orders.length} order(s). Average order value: ${formatCurrency(averageOrderValue)}.`}
            </p>
          </div>
        </div>

        <div className="summary-stat-box">
          <span className="summary-stat-tag">RECORDED SALES</span>
          <strong className="summary-stat-num">{formatCurrency(totalRevenue)}</strong>
        </div>
      </div>

      {/* Actual Grounded Telemetry Cards */}
      <div className="insights-cards-list">
        {/* 1. Catalogue Readiness */}
        <div className="content-card insight-card">
          <div className="insight-card-topbar">
            <div className="topbar-left-tags">
              <span className="priority-tag priority-medium">CATALOGUE</span>
              <span className="category-tag">STORE READINESS</span>
            </div>

            <span className="impact-badge">{products.length} Products</span>
          </div>

          <div className="insight-header-row">
            <div className="insight-icon-container">
              <Store size={16} />
            </div>
            <h3>Store Catalogue Readiness</h3>
          </div>

          <div className="insight-triad-grid">
            <div className="triad-cell">
              <span className="triad-label">CURRENT STATUS</span>
              <p>
                {products.length === 0
                  ? "You have not published any products to your store repository yet."
                  : `Your store currently has ${products.length} handcrafted creation${products.length === 1 ? "" : "s"} listed in the repository.`}
              </p>
            </div>

            <div className="triad-cell">
              <span className="triad-label">DATA ASSESSMENT</span>
              <p>
                {products.length === 0
                  ? "Products with detailed stories and calculated cost breakdowns attract verified buyers."
                  : "Catalogue listings are ready with material breakdowns and calculated cost pricing."}
              </p>
            </div>

            <div className="triad-cell action-cell">
              <span className="triad-label">ACTION</span>
              <div className="insight-btn-group">
                <button
                  className="primary-button compact-btn"
                  onClick={() => (navigateTo ? navigateTo("create") : (window.location.href = "#"))}
                  type="button"
                >
                  <Plus size={14} />
                  <span>Create new product</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Materials Health */}
        <div className="content-card insight-card">
          <div className="insight-card-topbar">
            <div className="topbar-left-tags">
              <span
                className={`priority-tag ${
                  lowStockCount > 0 ? "priority-high" : "priority-medium"
                }`}
              >
                {lowStockCount > 0 ? "ALERT" : "HEALTHY"}
              </span>
              <span className="category-tag">WORKSHOP SUPPLIES</span>
            </div>

            <span className="impact-badge">{materials.length} Materials Tracked</span>
          </div>

          <div className="insight-header-row">
            <div className="insight-icon-container">
              <Package size={16} />
            </div>
            <h3>Raw Materials Stock Health</h3>
          </div>

          <div className="insight-triad-grid">
            <div className="triad-cell">
              <span className="triad-label">CURRENT STATUS</span>
              <p>
                {materials.length === 0
                  ? "No raw materials are currently tracked in your workshop database."
                  : lowStockCount === 0
                  ? `All ${materials.length} tracked materials are above minimum stock levels.`
                  : `${lowStockCount} material${lowStockCount > 1 ? "s are" : " is"} at or below minimum threshold: ${lowStockMaterials.map(m => m.name).join(", ")}.`}
              </p>
            </div>

            <div className="triad-cell">
              <span className="triad-label">DATA ASSESSMENT</span>
              <p>
                {lowStockCount > 0
                  ? `Restocking ${lowStockMaterials.map(m => m.name).join(", ")} promptly will ensure upcoming orders can be fulfilled without production delays.`
                  : "Maintaining sufficient raw materials ensures that production workflows remain uninterrupted when orders arrive."}
              </p>
            </div>

            <div className="triad-cell action-cell">
              <span className="triad-label">ACTION</span>
              <div className="insight-btn-group">
                <button
                  className="secondary-button compact-btn"
                  onClick={() => (navigateTo ? navigateTo("dashboard") : (window.location.href = "#"))}
                  type="button"
                >
                  <span>View workshop stock</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Sales & Demand Intelligence */}
        <div className="content-card insight-card">
          <div className="insight-card-topbar">
            <div className="topbar-left-tags">
              <span className={`priority-tag ${orders.length > 0 ? "priority-high" : "priority-medium"}`}>
                {orders.length > 0 ? "LIVE DEMAND" : "PENDING ORDERS"}
              </span>
              <span className="category-tag">SALES INTELLIGENCE</span>
            </div>

            <span className="impact-badge">
              {orders.length === 0
                ? "0 Sales Recorded"
                : `${orders.length} Order${orders.length === 1 ? "" : "s"} (${totalQuantitySold} Units)`}
            </span>
          </div>

          <div className="insight-header-row">
            <div className="insight-icon-container">
              <TrendingUp size={16} />
            </div>
            <h3>Customer Demand & Sales Feedback</h3>
          </div>

          <div className="insight-triad-grid">
            <div className="triad-cell">
              <span className="triad-label">CURRENT STATUS</span>
              <p>
                {orders.length === 0
                  ? "No sales transactions have been logged in the store database yet."
                  : topSeller
                  ? `"${topSeller[0]}" leads sales with ${topSeller[1].count} unit(s) sold (${formatCurrency(topSeller[1].revenue)} total).`
                  : `${orders.length} order(s) logged totaling ${formatCurrency(totalRevenue)}.`}
              </p>
            </div>

            <div className="triad-cell">
              <span className="triad-label">{orders.length > 0 ? "FEEDBACK LOOP" : "WHY DATA MATTERS"}</span>
              <p>
                {orders.length === 0
                  ? "Price elasticity and customer preference algorithms require genuine sales transactions to generate meaningful recommendations."
                  : "Customer purchasing feedback confirms market demand. Restock associated workshop materials to ensure production capacity keeps pace with repeat demand."}
              </p>
            </div>

            <div className="triad-cell action-cell">
              <span className="triad-label">ACTION</span>
              <div className="insight-btn-group">
                <button
                  className="secondary-button compact-btn"
                  onClick={() => (navigateTo ? navigateTo("catalogue") : (window.location.href = "#"))}
                  type="button"
                >
                  <span>View live listings</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Insights;
