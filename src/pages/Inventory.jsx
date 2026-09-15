import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Layers,
  Package,
  Plus,
  RefreshCw,
  Store
} from "lucide-react";
import PageHeader from "../components/PageHeader";
import { getMaterials, getInventory } from "../services/craftlensApi";
import { formatCurrency } from "../utils/formatters";

function Inventory({ navigateTo }) {
  const [materials, setMaterials] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const [matRes, invRes] = await Promise.allSettled([
        getMaterials(),
        getInventory()
      ]);

      setMaterials(matRes.status === "fulfilled" ? matRes.value.materials || [] : []);
      setInventory(invRes.status === "fulfilled" ? invRes.value.inventory || [] : []);
    } catch (err) {
      console.error("Inventory fetch error:", err);
      setError("Could not retrieve workshop materials and inventory.");
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

  const healthyStockCount = materials.length - lowStockMaterials.length;

  return (
    <div className="inventory-page" style={{ padding: "32px 40px", maxWidth: "1400px", margin: "0 auto" }}>
      <PageHeader
        eyebrow="WORKSHOP INVENTORY"
        title="Materials & Stock"
        description="Real-time tracking of raw craft supplies, workshop inventory thresholds, and supplier details."
      />

      {/* Summary Stat Grid */}
      <div className="dashboard-stats-grid" style={{ marginBottom: "28px" }}>
        <div className="stat-metric-card">
          <div className="stat-card-topbar">
            <span className="stat-card-label">Materials Tracked</span>
            <div className="stat-icon-wrapper" style={{ background: "#ECFDF5", color: "#059669" }}>
              <Package size={18} />
            </div>
          </div>
          <div className="stat-value-row">
            <span className="stat-number">{materials.length}</span>
            <span className="stat-unit">materials</span>
          </div>
          <div className="stat-trend-footer">
            <span className="trend-context">Active workshop supplies</span>
          </div>
        </div>

        <div className="stat-metric-card">
          <div className="stat-card-topbar">
            <span className="stat-card-label">Low Stock Alerts</span>
            <div className="stat-icon-wrapper" style={{ background: lowStockMaterials.length > 0 ? "#FEF2F2" : "#ECFDF5", color: lowStockMaterials.length > 0 ? "#DC2626" : "#059669" }}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="stat-value-row">
            <span className="stat-number">{lowStockMaterials.length}</span>
            <span className="stat-unit">{lowStockMaterials.length === 1 ? "alert" : "alerts"}</span>
          </div>
          <div className="stat-trend-footer">
            <span className={`trend-badge ${lowStockMaterials.length > 0 ? "warning" : "positive"}`}>
              {lowStockMaterials.length > 0 ? "Requires reorder" : "All healthy"}
            </span>
          </div>
        </div>

        <div className="stat-metric-card">
          <div className="stat-card-topbar">
            <span className="stat-card-label">Healthy Stock</span>
            <div className="stat-icon-wrapper" style={{ background: "#EFF6FF", color: "#2563EB" }}>
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="stat-value-row">
            <span className="stat-number">{healthyStockCount}</span>
            <span className="stat-unit">supplies</span>
          </div>
          <div className="stat-trend-footer">
            <span className="trend-context">Above minimum reorder level</span>
          </div>
        </div>

        <div className="stat-metric-card">
          <div className="stat-card-topbar">
            <span className="stat-card-label">Finished Goods</span>
            <div className="stat-icon-wrapper" style={{ background: "#F3E8FF", color: "#7C3AED" }}>
              <Layers size={18} />
            </div>
          </div>
          <div className="stat-value-row">
            <span className="stat-number">{inventory.length}</span>
            <span className="stat-unit">products</span>
          </div>
          <div className="stat-trend-footer">
            <span className="trend-context">Ready units in workshop</span>
          </div>
        </div>
      </div>

      {/* Low Stock Warning Banner if any low */}
      {lowStockMaterials.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "16px 20px", background: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: "8px", marginBottom: "24px", color: "#92400E" }}>
          <AlertTriangle size={20} style={{ color: "#D97706", flexShrink: 0 }} />
          <div>
            <strong style={{ display: "block", fontSize: "14px", fontWeight: 600 }}>
              Low Stock Alert: {lowStockMaterials.map((m) => m.name).join(", ")}
            </strong>
            <span style={{ fontSize: "13px" }}>
              Current stock has reached or fallen below the minimum safety threshold. Reorder soon to prevent workshop delays.
            </span>
          </div>
        </div>
      )}

      {/* Materials Table Card */}
      <div className="dashboard-section-card">
        <div className="section-card-header">
          <div>
            <h2>Raw Workshop Materials</h2>
            <p>Live inventory quantities, unit costs, and supplier sources.</p>
          </div>
          <button
            className="secondary-action-btn"
            onClick={loadData}
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
              onClick={loadData}
              style={{ marginTop: "8px", background: "transparent", border: "none", color: "#B91C1C", textDecoration: "underline", cursor: "pointer", fontWeight: 600 }}
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div style={{ padding: "48px 0", textAlign: "center", color: "var(--text-muted)" }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 12px" }} />
            <p>Loading workshop inventory...</p>
          </div>
        ) : materials.length === 0 ? (
          <div style={{ padding: "56px 20px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "var(--surface-subtle)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
              <Package size={28} />
            </div>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
              No raw materials recorded
            </h3>
            <p style={{ fontSize: "13.5px", color: "var(--text-muted)", margin: 0, maxWidth: "420px" }}>
              Your current materials are sufficiently stocked or haven't been added to the workshop ledger yet.
            </p>
          </div>
        ) : (
          <div className="batches-table-container">
            <table className="batches-table">
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Current Quantity</th>
                  <th>Minimum Stock</th>
                  <th>Status</th>
                  <th>Unit Cost</th>
                  <th>Supplier Source</th>
                </tr>
              </thead>
              <tbody>
                {materials.map((mat) => {
                  const isLow = Number(mat.quantity) <= Number(mat.minimumStockLevel || 0);
                  const supplierText = mat.supplier
                    ? `${mat.supplier}${mat.location ? ` (${mat.location})` : ""}`
                    : "Supplier information unavailable";

                  return (
                    <tr key={mat.id} className="batch-row">
                      <td>
                        <strong style={{ color: "var(--text-primary)" }}>{mat.name}</strong>
                      </td>
                      <td>
                        <strong>{mat.quantity}</strong> {mat.unit || "units"}
                      </td>
                      <td style={{ color: "var(--text-secondary)" }}>
                        {mat.minimumStockLevel} {mat.unit || "units"}
                      </td>
                      <td>
                        <span
                          className="stage-status-pill"
                          style={{
                            background: isLow ? "#FEF2F2" : "#ECFDF5",
                            color: isLow ? "#DC2626" : "#059669"
                          }}
                        >
                          {isLow ? "Low Stock" : "In Stock"}
                        </span>
                      </td>
                      <td>
                        {mat.estimatedCostPerUnit
                          ? `${formatCurrency(mat.estimatedCostPerUnit)} / ${mat.unit || "unit"}`
                          : "—"}
                      </td>
                      <td style={{ color: "var(--text-muted)", fontSize: "12.5px" }}>
                        {supplierText}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default Inventory;

