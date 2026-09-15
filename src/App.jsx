import { useEffect, useState } from "react";
import {
  Bell,
  HelpCircle,
  LayoutDashboard,
  Package,
  Plus,
  PlusCircle,
  Search,
  Settings,
  ShoppingBag,
  Sparkles,
  Store
} from "lucide-react";

import Dashboard from "./pages/Dashboard";
import CreateProduct from "./pages/CreateProduct";
import Catalogue from "./pages/Catalogue";
import Insights from "./pages/Insights";
import Orders from "./pages/Orders";
import Inventory from "./pages/Inventory";
import Toast from "./components/Toast";
import { getProducts, getOrders, getMaterials } from "./services/craftlensApi";

import "./App.css";

function App() {
  const [activePage, setActivePage] = useState("dashboard");
  const [toast, setToast] = useState(null);
  const [counts, setCounts] = useState({
    products: 0,
    orders: 0,
    lowStockMaterials: 0
  });

  const loadCounts = async () => {
    try {
      const [prodRes, orderRes, matRes] = await Promise.allSettled([
        getProducts(),
        getOrders(),
        getMaterials()
      ]);

      const products =
        prodRes.status === "fulfilled" ? prodRes.value.products || [] : [];
      const orders =
        orderRes.status === "fulfilled" ? orderRes.value.orders || [] : [];
      const materials =
        matRes.status === "fulfilled" ? matRes.value.materials || [] : [];

      const lowStockCount = materials.filter(
        (m) => Number(m.quantity) <= Number(m.minimumStockLevel || 0)
      ).length;

      setCounts({
        products: products.length,
        orders: orders.length,
        lowStockMaterials: lowStockCount
      });
    } catch (err) {
      console.warn("Could not sync sidebar counts:", err);
    }
  };

  useEffect(() => {
    loadCounts();
  }, [activePage]);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    window.setTimeout(() => {
      setToast(null);
    }, 3200);
  };

  const navigateTo = (page) => {
    setActivePage(page);
    window.scrollTo(0, 0);
  };

  const renderPage = () => {
    if (activePage === "create") {
      return (
        <CreateProduct
          showToast={showToast}
          navigateTo={navigateTo}
          onProductPublished={loadCounts}
        />
      );
    }

    if (activePage === "catalogue") {
      return <Catalogue navigateTo={navigateTo} onCatalogueChange={loadCounts} />;
    }

    if (activePage === "insights") {
      return <Insights navigateTo={navigateTo} />;
    }

    if (activePage === "orders") {
      return <Orders navigateTo={navigateTo} />;
    }

    if (activePage === "inventory") {
      return <Inventory navigateTo={navigateTo} />;
    }

    return <Dashboard navigateTo={navigateTo} />;
  };

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "create", label: "Create Product", icon: PlusCircle },
    { id: "catalogue", label: "Catalogue", icon: Store, badge: counts.products > 0 ? String(counts.products) : null },
    { id: "insights", label: "AI Insights", icon: Sparkles, badge: "AI" },
    {
      id: "orders",
      label: "Orders",
      icon: ShoppingBag,
      badge: counts.orders > 0 ? String(counts.orders) : null
    },
    {
      id: "inventory",
      label: "Materials & Stock",
      icon: Package,
      badge: counts.lowStockMaterials > 0 ? String(counts.lowStockMaterials) : null
    }
  ];

  return (
    <div className="app-shell">
      {/* Integrated Left Sidebar (Screenshot 2 Structure) */}
      <aside className="app-sidebar">
        <div
          className="sidebar-brand"
          onClick={() => navigateTo("dashboard")}
          role="button"
          tabIndex={0}
        >
          <div className="brand-logo-icon">
            <Sparkles size={18} className="brand-sparkle-icon" />
          </div>
          <div className="brand-text-block">
            <span className="brand-title">CraftLens</span>
            <span className="brand-subtitle">Artisan Studio</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-group-title">MAIN MENU</div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;

            return (
              <button
                key={item.id}
                className={"nav-item-btn " + (isActive ? "active" : "")}
                onClick={() => navigateTo(item.id)}
                type="button"
              >
                <span className="nav-item-icon-wrap">
                  <Icon size={18} />
                </span>
                <span className="nav-item-text">{item.label}</span>
                {item.badge && (
                  <span className={"nav-item-badge " + (item.badge === "AI" ? "badge-ai" : "")}>
                    {item.badge}
                  </span>
                )}
                {isActive && <span className="active-nav-indicator" />}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-links-stack">
            <button
              className="sidebar-secondary-btn"
              type="button"
              onClick={() => showToast("Artisan guide and voice tips ready", "info")}
            >
              <HelpCircle size={16} />
              <span>Help & Guide</span>
            </button>
            <button
              className="sidebar-secondary-btn"
              type="button"
              onClick={() => showToast("Studio settings accessible", "info")}
            >
              <Settings size={16} />
              <span>Settings</span>
            </button>
          </div>

          <div
            className="artisan-profile-card"
            onClick={() => navigateTo("dashboard")}
            role="button"
            tabIndex={0}
          >
            <div className="artisan-avatar-circle">
              <span>AC</span>
              <span className="artisan-status-dot" />
            </div>
            <div className="artisan-meta-block">
              <strong>Anita Crafts</strong>
              <span>Master Artisan</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <div className="app-main-column">
        {/* Top Header Bar (Screenshot 2 Structure) */}
        <header className="app-header">
          <div className="header-search-box">
            <Search size={16} className="search-lead-icon" />
            <input
              type="text"
              placeholder="Search products, batches, materials, orders..."
              className="header-search-input"
              onKeyDown={(e) => {
                if (e.key === "Enter") navigateTo("catalogue");
              }}
            />
            <span className="shortcut-pill">⌘K</span>
          </div>

          <div className="header-right-actions">
            <button
              className="header-primary-btn"
              onClick={() => navigateTo("create")}
              type="button"
            >
              <Plus size={16} />
              <span>New Product</span>
            </button>

            <button
              className="header-icon-btn"
              aria-label="Notifications"
              type="button"
              onClick={() => showToast("Raw bamboo strips stock is low (12 bundles remaining)", "warning")}
            >
              <Bell size={17} />
              <span className="header-notif-dot" />
            </button>

            <div
              className="header-avatar-btn"
              onClick={() => navigateTo("dashboard")}
              role="button"
              tabIndex={0}
              title="Anita Crafts"
            >
              <span>AC</span>
            </div>
          </div>
        </header>

        {/* Dynamic Page Viewport */}
        <main className="app-content-body">
          <div className="content-inner-wrapper">
            {renderPage()}
          </div>
        </main>
      </div>

      <Toast
        message={toast?.message}
        type={toast?.type}
        onClose={() => setToast(null)}
      />
    </div>
  );
}

export default App;
