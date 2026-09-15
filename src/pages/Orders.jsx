import { useEffect, useState } from "react";
import {
  ArrowRight,
  Clock,
  PackageCheck,
  RefreshCw,
  ShoppingBag,
  Store,
  TrendingUp
} from "lucide-react";
import PageHeader from "../components/PageHeader";
import { getOrders } from "../services/craftlensApi";
import { formatCurrency } from "../utils/formatters";

function Orders({ navigateTo }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOrders = async () => {
    try {
      setLoading(true);
      setError("");
      const result = await getOrders();
      setOrders(result.orders || []);
    } catch (err) {
      console.error("Orders fetch error:", err);
      setError("Could not retrieve customer orders from server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const totalRevenue = orders.reduce(
    (sum, o) => sum + Number(o.totalAmount || o.price || o.amount || 0),
    0
  );

  const pendingOrders = orders.filter(
    (o) => (o.status || "").toLowerCase() === "pending"
  );
  const completedOrders = orders.filter(
    (o) => (o.status || "").toLowerCase() === "completed" || (o.status || "").toLowerCase() === "delivered"
  );

  return (
    <div className="orders-page" style={{ padding: "32px 40px", maxWidth: "1400px", margin: "0 auto" }}>
      <PageHeader
        eyebrow="SALES & FULFILLMENT"
        title="Customer Orders"
        description="Customer orders placed across your published creations, verified directly against backend records."
      />

      {/* Summary Stat Grid */}
      <div className="dashboard-stats-grid" style={{ marginBottom: "28px" }}>
        <div className="stat-metric-card">
          <div className="stat-card-topbar">
            <span className="stat-card-label">Total Orders</span>
            <div className="stat-icon-wrapper" style={{ background: "#EFF6FF", color: "#2563EB" }}>
              <ShoppingBag size={18} />
            </div>
          </div>
          <div className="stat-value-row">
            <span className="stat-number">{orders.length}</span>
            <span className="stat-unit">{orders.length === 1 ? "order" : "orders"}</span>
          </div>
          <div className="stat-trend-footer">
            <span className="trend-context">
              {orders.length === 0 ? "Awaiting first order" : `${orders.length} recorded`}
            </span>
          </div>
        </div>

        <div className="stat-metric-card">
          <div className="stat-card-topbar">
            <span className="stat-card-label">Store Revenue</span>
            <div className="stat-icon-wrapper" style={{ background: "#ECFDF5", color: "#059669" }}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="stat-value-row">
            <span className="stat-number">{formatCurrency(totalRevenue)}</span>
            <span className="stat-unit">INR</span>
          </div>
          <div className="stat-trend-footer">
            <span className="trend-context">Calculated from order records</span>
          </div>
        </div>

        <div className="stat-metric-card">
          <div className="stat-card-topbar">
            <span className="stat-card-label">Pending Fulfillment</span>
            <div className="stat-icon-wrapper" style={{ background: "#FFFBEB", color: "#D97706" }}>
              <Clock size={18} />
            </div>
          </div>
          <div className="stat-value-row">
            <span className="stat-number">{pendingOrders.length}</span>
            <span className="stat-unit">pending</span>
          </div>
          <div className="stat-trend-footer">
            <span className="trend-context">Orders awaiting dispatch</span>
          </div>
        </div>

        <div className="stat-metric-card">
          <div className="stat-card-topbar">
            <span className="stat-card-label">Delivered Orders</span>
            <div className="stat-icon-wrapper" style={{ background: "#F3E8FF", color: "#7C3AED" }}>
              <PackageCheck size={18} />
            </div>
          </div>
          <div className="stat-value-row">
            <span className="stat-number">{completedOrders.length}</span>
            <span className="stat-unit">completed</span>
          </div>
          <div className="stat-trend-footer">
            <span className="trend-context">Successfully fulfilled</span>
          </div>
        </div>
      </div>

      {/* Orders List Container */}
      <div className="dashboard-section-card">
        <div className="section-card-header">
          <div>
            <h2>Order History</h2>
            <p>Direct records of customer transactions and fulfillment stages.</p>
          </div>
          <button
            className="secondary-action-btn"
            onClick={loadOrders}
            disabled={loading}
            type="button"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {error && (
          <div style={{ padding: "16px", background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: "8px", color: "#B91C1C", marginBottom: "16px" }}>
            <p style={{ margin: 0, fontWeight: 600 }}>{error}</p>
            <button
              onClick={loadOrders}
              style={{ marginTop: "8px", background: "transparent", border: "none", color: "#B91C1C", textDecoration: "underline", cursor: "pointer", fontWeight: 600 }}
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div style={{ padding: "48px 0", textAlign: "center", color: "var(--text-muted)" }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 12px" }} />
            <p>Loading customer orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <div style={{ padding: "56px 20px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "var(--surface-subtle)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
              <ShoppingBag size={28} />
            </div>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
              No customer orders yet
            </h3>
            <p style={{ fontSize: "13.5px", color: "var(--text-muted)", margin: 0, maxWidth: "420px" }}>
              Customer orders will appear here once your first sale is made. Share your published creations with customers to start receiving orders.
            </p>
            <button
              className="primary-action-btn"
              onClick={() => navigateTo && navigateTo("catalogue")}
              style={{ marginTop: "12px" }}
              type="button"
            >
              <Store size={15} />
              View Catalogue Creations
            </button>
          </div>
        ) : (
          <div className="batches-table-container">
            <table className="batches-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Creation</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((ord) => (
                  <tr key={ord.id} className="batch-row">
                    <td>
                      <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "12px", color: "var(--text-secondary)" }}>
                        {ord.id}
                      </span>
                    </td>
                    <td>
                      <strong style={{ color: "var(--text-primary)" }}>{ord.customerName || ord.customer || "Direct Customer"}</strong>
                    </td>
                    <td>{ord.productTitle || ord.item || "Handcrafted Product"}</td>
                    <td>
                      <strong>{formatCurrency(ord.totalAmount || ord.price || 0)}</strong>
                    </td>
                    <td>
                      <span
                        className="stage-status-pill"
                        style={{
                          background: ord.status === "completed" ? "#ECFDF5" : "#FFFBEB",
                          color: ord.status === "completed" ? "#059669" : "#D97706"
                        }}
                      >
                        {ord.status || "Pending"}
                      </span>
                    </td>
                    <td style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                      {ord.createdAt ? new Date(ord.createdAt).toLocaleDateString() : "Recent"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default Orders;

