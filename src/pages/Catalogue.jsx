import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Layers,
  Package,
  PlusCircle,
  RefreshCw,
  Search,
  Share2,
  ShoppingBag,
  Sparkles,
  Store,
  X
} from "lucide-react";
import PageHeader from "../components/PageHeader";
import { getProducts, getInventory, createOrder } from "../services/craftlensApi";
import { formatCurrency } from "../utils/formatters";

// Robust, graceful image component with zero broken images
function ProductImage({ image, title, category }) {
  const [hasError, setHasError] = useState(false);

  const isExpiredBlob = image && typeof image === "string" && image.startsWith("blob:");

  if (!image || isExpiredBlob || hasError) {
    const cat = (category || "").toLowerCase();
    const emoji =
      cat.includes("bamboo") ? "🧺" :
      cat.includes("clay") || cat.includes("potter") ? "🏺" :
      cat.includes("textile") || cat.includes("dye") || cat.includes("fabric") ? "🧵" :
      cat.includes("metal") || cat.includes("brass") ? "🪔" :
      cat.includes("wood") ? "🪵" : "🧺";

    return (
      <div className="product-image-fallback">
        <span className="fallback-emoji">{emoji}</span>
        <span className="fallback-caption">Authentic Craft Listing</span>
      </div>
    );
  }

  return (
    <img
      src={image}
      alt={title || "Handmade Product"}
      onError={() => setHasError(true)}
      loading="lazy"
    />
  );
}

function Catalogue({ navigateTo, onCatalogueChange }) {
  const [products, setProducts] = useState([]);
  const [inventoryList, setInventoryList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Customer Purchase Modal State
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [orderForm, setOrderForm] = useState({
    customerName: "",
    customerPhone: "",
    shippingAddress: "",
    quantity: 1,
    paymentMethod: "Direct UPI"
  });
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [orderConfirmation, setOrderConfirmation] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError("");

      const [prodRes, invRes] = await Promise.allSettled([
        getProducts(),
        getInventory()
      ]);

      const rawProducts = prodRes.status === "fulfilled" ? prodRes.value.products || [] : [];
      const rawInventory = invRes.status === "fulfilled" ? invRes.value.inventory || [] : [];

      setInventoryList(rawInventory);

      // Deduplicate products strictly by unique id
      const uniqueProductsMap = new Map();
      rawProducts.forEach((p) => {
        if (p && p.id && !uniqueProductsMap.has(p.id)) {
          uniqueProductsMap.set(p.id, p);
        }
      });
      const uniqueList = Array.from(uniqueProductsMap.values());

      setProducts(uniqueList);
      if (onCatalogueChange) {
        onCatalogueChange();
      }
    } catch (err) {
      console.error("Catalogue loading error:", err);
      setError("Could not load your products.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  // Helper to find real inventory stock for a product
  const getProductStock = (product) => {
    if (!product) return null;
    const profile = product.productProfile || product;
    const title = (profile.title || "").toLowerCase();

    const matched = inventoryList.find(
      (inv) => (product.id && String(inv.itemId) === String(product.id)) ||
               (inv.itemName && inv.itemName.toLowerCase() === title)
    );

    return matched ? Number(matched.quantity) : null;
  };

  // Open modal
  const openProductModal = (product) => {
    setSelectedProduct(product);
    setOrderConfirmation(null);
    setOrderError("");
    setOrderForm({
      customerName: "",
      customerPhone: "",
      shippingAddress: "",
      quantity: 1,
      paymentMethod: "Direct UPI"
    });
  };

  // Close modal
  const closeProductModal = () => {
    setSelectedProduct(null);
    setOrderConfirmation(null);
    setOrderError("");
  };

  // WhatsApp share
  const handleShareWhatsApp = (product) => {
    const profile = product.productProfile || product;
    const price = product.pricing?.recommendedPrice || product.price || 0;
    const text = `*${profile.title || "Handcrafted Product"}*\n${profile.description || profile.artisanStory || ""}\nPrice: ₹${price}\nCraft: ${profile.craftType || profile.category || "Handicraft"}\nCrafted by Anita Crafts\nOrder directly on CraftLens: ${window.location.origin}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  // Copy share link
  const handleCopyLink = () => {
    const link = `${window.location.origin}/#catalogue`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Submit real customer order
  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    if (!orderForm.customerName.trim()) {
      setOrderError("Please enter your name to complete the order.");
      return;
    }

    try {
      setOrderSubmitting(true);
      setOrderError("");
      const profile = selectedProduct.productProfile || selectedProduct;
      const unitPrice = selectedProduct.pricing?.recommendedPrice || selectedProduct.price || 0;
      const qty = Math.max(1, Number(orderForm.quantity) || 1);

      const payload = {
        productId: selectedProduct.id,
        productTitle: profile.title || "Handcrafted Product",
        price: unitPrice,
        quantity: qty,
        totalAmount: unitPrice * qty,
        customerName: orderForm.customerName.trim(),
        customerPhone: orderForm.customerPhone.trim() || null,
        shippingAddress: orderForm.shippingAddress.trim() || null,
        paymentMethod: orderForm.paymentMethod || "Direct UPI",
        status: "pending"
      };

      const res = await createOrder(payload);
      setOrderConfirmation(res.order);
      await loadProducts();
      if (onCatalogueChange) {
        onCatalogueChange();
      }
    } catch (err) {
      setOrderError(err.message || "Could not place order. Please try again.");
    } finally {
      setOrderSubmitting(false);
    }
  };

  // Derive categories strictly from actual loaded products
  const uniqueCategoryNames = Array.from(
    new Set(
      products
        .map((p) => p.productProfile?.category || p.category)
        .filter(Boolean)
    )
  );

  const categories = [
    { id: "all", label: "All Creations" },
    ...uniqueCategoryNames.map((cat) => ({
      id: cat.toLowerCase(),
      label: cat
    }))
  ];

  const filteredProducts = products.filter((product) => {
    const profile = product.productProfile || product;
    const title = (profile.title || "").toLowerCase();
    const category = (profile.category || "").toLowerCase();
    const materials = (
      typeof profile.materials === "string"
        ? profile.materials
        : Array.isArray(profile.materials)
        ? profile.materials.join(" ")
        : ""
    ).toLowerCase();

    const matchesSearch =
      title.includes(searchQuery.toLowerCase()) ||
      category.includes(searchQuery.toLowerCase()) ||
      materials.includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === "all" ||
      category.includes(selectedCategory.toLowerCase());

    return matchesSearch && matchesCategory;
  });

  const totalCount = products.length;
  const publishedCount = products.filter(
    (p) => (p.status || "").toLowerCase() === "published"
  ).length;
  const categoriesCount = uniqueCategoryNames.length;

  return (
    <div className="catalogue-page">
      <PageHeader
        eyebrow="YOUR STORE"
        title="Product Catalogue"
        description="Manage your verified handicraft listings from the store database."
        actionLabel="+ Create product"
        onAction={() => navigateTo("create")}
      />

      {/* Useful Real Metrics Summary Bar */}
      <div className="catalogue-metrics-strip">
        <div className="catalogue-metric-cell">
          <span className="metric-cell-label">Total Creations</span>
          <strong className="metric-cell-val">{totalCount}</strong>
        </div>

        <div className="catalogue-metric-cell">
          <span className="metric-cell-label">Live Listings</span>
          <strong className="metric-cell-val">{publishedCount}</strong>
        </div>

        <div className="catalogue-metric-cell">
          <span className="metric-cell-label">Active Craft Types</span>
          <strong className="metric-cell-val">{categoriesCount}</strong>
        </div>

        <div className="catalogue-metric-cell cell-action">
          <button
            className="secondary-button compact-refresh"
            onClick={loadProducts}
            disabled={loading}
            type="button"
          >
            <RefreshCw size={14} className={loading ? "spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="catalogue-controls-bar">
        <div className="catalogue-search-field">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search by craft title, material, or keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="clear-search-btn"
              onClick={() => setSearchQuery("")}
              type="button"
            >
              ×
            </button>
          )}
        </div>

        <div className="category-filter-pills">
          {categories.map((cat) => (
            <button
              key={cat.id}
              className={`category-pill ${
                selectedCategory === cat.id ? "active" : ""
              }`}
              onClick={() => setSelectedCategory(cat.id)}
              type="button"
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Catalogue Grid */}
      {loading ? (
        <div className="content-card catalogue-loading-state">
          <div className="loading-spinner-orb">
            <Sparkles size={24} />
          </div>
          <h3>Loading catalogue...</h3>
          <p>Connecting to store repository</p>
        </div>
      ) : error ? (
        <div className="content-card catalogue-error-state">
          <h3>Unable to load catalogue</h3>
          <p>{error}</p>
          <button
            className="secondary-button"
            onClick={loadProducts}
            type="button"
          >
            Try again
          </button>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="content-card catalogue-empty-state">
          <div className="empty-state-icon">
            <Store size={36} />
          </div>
          <h3>{totalCount === 0 ? "No products published yet" : "No matching products found"}</h3>
          <p>
            {totalCount === 0
              ? "You have not published any products to your store repository yet. Create your first listing using the voice-first AI flow."
              : "Try adjusting your search keywords or filter category."}
          </p>
          {totalCount === 0 && (
            <button
              className="primary-button"
              onClick={() => navigateTo("create")}
              type="button"
            >
              + Create your first product
            </button>
          )}
        </div>
      ) : (
        <div className="catalogue-products-grid">
          {filteredProducts.map((product) => {
            const profile = product.productProfile || product;
            const price =
              product.pricing?.recommendedPrice || product.price || 0;
            const image = product.imagePreview || product.image;
            const stock = getProductStock(product);

            return (
              <div
                className="catalogue-product-card"
                key={product.id}
                onClick={() => openProductModal(product)}
                style={{ cursor: "pointer" }}
                role="button"
                tabIndex={0}
              >
                <div className="product-card-image-wrap">
                  <ProductImage
                    image={image}
                    title={profile.title}
                    category={profile.category}
                  />

                  <div style={{ position: "absolute", top: "10px", right: "10px", display: "flex", gap: "6px" }}>
                    {stock !== null && (
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          padding: "3px 8px",
                          borderRadius: "6px",
                          background: stock > 0 ? "rgba(16, 185, 129, 0.9)" : "rgba(239, 68, 68, 0.9)",
                          color: "#fff"
                        }}
                      >
                        {stock > 0 ? `${stock} in stock` : "Out of stock"}
                      </span>
                    )}
                    <span className="product-status-tag">
                      {product.status || "Published"}
                    </span>
                  </div>
                </div>

                <div className="product-card-body">
                  <span className="product-category-label">
                    {profile.category || "Handmade Craft"}
                  </span>

                  <h3 className="product-card-title">{profile.title || "Handmade Craft"}</h3>

                  <p className="product-card-desc">
                    {profile.description || profile.artisanStory || "Handmade using traditional artisan techniques."}
                  </p>

                  <div className="product-card-footer">
                    <div>
                      <span className="price-kicker">PRICE</span>
                      <strong className="product-card-price">
                        {price > 0 ? formatCurrency(price) : "Price not set"}
                      </strong>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <button
                        className="secondary-button"
                        style={{ padding: "5px 10px", fontSize: "12px" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          openProductModal(product);
                        }}
                        type="button"
                      >
                        <ShoppingBag size={13} style={{ marginRight: "4px" }} />
                        Buy
                      </button>
                      <button
                        className="secondary-button"
                        style={{ padding: "5px 8px" }}
                        title="Share via WhatsApp"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShareWhatsApp(product);
                        }}
                        type="button"
                      >
                        <Share2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ============================================================ */}
      {/* PRODUCT DETAILS & CUSTOMER PURCHASE MODAL (FLOW CONNECTION)  */}
      {/* ============================================================ */}
      {selectedProduct && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px"
          }}
          onClick={closeProductModal}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "760px",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
              padding: "28px"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
              <div>
                <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#059669", letterSpacing: "0.05em" }}>
                  {(selectedProduct.productProfile || selectedProduct).category || "Handicraft"} · {(selectedProduct.productProfile || selectedProduct).craftType || "Traditional Craft"}
                </span>
                <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#0F172A", margin: "4px 0 0 0" }}>
                  {(selectedProduct.productProfile || selectedProduct).title || "Handmade Creation"}
                </h2>
              </div>
              <button
                onClick={closeProductModal}
                style={{ background: "#F1F5F9", border: "none", borderRadius: "50%", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#475569" }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Order Confirmation Screen if completed */}
            {orderConfirmation ? (
              <div style={{ textAlign: "center", padding: "32px 16px" }}>
                <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "#ECFDF5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  <CheckCircle2 size={36} />
                </div>
                <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#0F172A", margin: 0 }}>
                  Order Confirmed!
                </h3>
                <p style={{ color: "#64748B", fontSize: "14px", marginTop: "8px", maxWidth: "420px", margin: "8px auto 20px" }}>
                  Thank you, <strong>{orderConfirmation.customerName}</strong>! Your order for <strong>{orderConfirmation.quantity} unit(s)</strong> has been logged directly into the artisan workshop ledger.
                </p>

                <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "16px", maxWidth: "420px", margin: "0 auto 24px", textAlign: "left", fontSize: "13px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                    <span style={{ color: "#64748B" }}>Order ID:</span>
                    <strong style={{ fontFamily: "monospace" }}>{orderConfirmation.id}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                    <span style={{ color: "#64748B" }}>Total Paid:</span>
                    <strong>{formatCurrency(orderConfirmation.totalAmount)}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                    <span style={{ color: "#64748B" }}>Payment Method:</span>
                    <span>{orderConfirmation.paymentMethod}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748B" }}>Workshop Stock:</span>
                    <span style={{ color: "#059669", fontWeight: 600 }}>
                      {orderConfirmation.stockDeducted ? "Decremented in live inventory" : "Tracked in orders"}
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "center", gap: "12px" }}>
                  <button
                    className="primary-button"
                    onClick={closeProductModal}
                    type="button"
                  >
                    Back to Catalogue
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => {
                      closeProductModal();
                      navigateTo("orders");
                    }}
                    type="button"
                  >
                    View in Orders
                  </button>
                </div>
              </div>
            ) : (
              /* Two-Column Purchase & Detail Grid */
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                {/* Left: Product Information & Story */}
                <div>
                  <div style={{ width: "100%", height: "200px", borderRadius: "10px", overflow: "hidden", marginBottom: "16px", background: "#F1F5F9" }}>
                    <ProductImage
                      image={selectedProduct.imagePreview || selectedProduct.image}
                      title={(selectedProduct.productProfile || selectedProduct).title}
                      category={(selectedProduct.productProfile || selectedProduct).category}
                    />
                  </div>

                  <div style={{ marginBottom: "16px" }}>
                    <h4 style={{ fontSize: "13px", fontWeight: 700, textTransform: "uppercase", color: "#64748B", margin: "0 0 6px 0" }}>
                      Artisan Story
                    </h4>
                    <p style={{ fontSize: "13.5px", color: "#334155", lineHeight: 1.5, margin: 0 }}>
                      {(selectedProduct.productProfile || selectedProduct).description || (selectedProduct.productProfile || selectedProduct).artisanStory || "Handmade piece created with authentic craftsmanship."}
                    </p>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "12.5px", background: "#F8FAFC", padding: "12px", borderRadius: "8px", border: "1px solid #E2E8F0", marginBottom: "16px" }}>
                    <div>
                      <span style={{ color: "#64748B", display: "block" }}>Craft Discipline</span>
                      <strong>{(selectedProduct.productProfile || selectedProduct).craftType || "Handicraft"}</strong>
                    </div>
                    <div>
                      <span style={{ color: "#64748B", display: "block" }}>Materials</span>
                      <strong>
                        {Array.isArray((selectedProduct.productProfile || selectedProduct).materials)
                          ? (selectedProduct.productProfile || selectedProduct).materials.join(", ")
                          : (selectedProduct.productProfile || selectedProduct).materials || "Natural Materials"}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: "#64748B", display: "block" }}>Dimensions</span>
                      <span>{(selectedProduct.productProfile || selectedProduct).dimensions || "Not specified"}</span>
                    </div>
                    <div>
                      <span style={{ color: "#64748B", display: "block" }}>Production Time</span>
                      <span>{(selectedProduct.productProfile || selectedProduct).productionTime || "Made to order"}</span>
                    </div>
                  </div>

                  {/* WhatsApp Share Card */}
                  <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: "14px", display: "flex", gap: "8px" }}>
                    <button
                      type="button"
                      onClick={() => handleShareWhatsApp(selectedProduct)}
                      style={{
                        flex: 1,
                        background: "#25D366",
                        color: "#FFFFFF",
                        border: "none",
                        borderRadius: "8px",
                        padding: "8px 12px",
                        fontSize: "12.5px",
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                        cursor: "pointer"
                      }}
                    >
                      <Share2 size={14} />
                      Share on WhatsApp
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      style={{
                        background: "#F1F5F9",
                        color: "#334155",
                        border: "1px solid #CBD5E1",
                        borderRadius: "8px",
                        padding: "8px 12px",
                        fontSize: "12.5px",
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        cursor: "pointer"
                      }}
                    >
                      {copiedLink ? <Check size={14} color="#059669" /> : <Copy size={14} />}
                      {copiedLink ? "Copied" : "Copy Link"}
                    </button>
                  </div>
                </div>

                {/* Right: Customer Purchase Form */}
                <div style={{ borderLeft: "1px solid #E2E8F0", paddingLeft: "24px" }}>
                  <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: "10px", padding: "14px", marginBottom: "16px" }}>
                    <span style={{ fontSize: "12px", color: "#166534", fontWeight: 600 }}>Direct Artisan Price</span>
                    <div style={{ fontSize: "24px", fontWeight: 800, color: "#15803D" }}>
                      {formatCurrency(selectedProduct.pricing?.recommendedPrice || selectedProduct.price || 0)}
                    </div>
                    <span style={{ fontSize: "12px", color: "#166534" }}>
                      {getProductStock(selectedProduct) !== null
                        ? `Workshop stock: ${getProductStock(selectedProduct)} units available`
                        : "Crafted directly in Anita Crafts studio"}
                    </span>
                  </div>

                  <form onSubmit={handlePlaceOrder}>
                    {orderError && (
                      <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", color: "#B91C1C", padding: "10px", borderRadius: "6px", fontSize: "12.5px", marginBottom: "12px" }}>
                        {orderError}
                      </div>
                    )}

                    <div style={{ marginBottom: "12px" }}>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                        Your Full Name *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Priya Sharma"
                        required
                        value={orderForm.customerName}
                        onChange={(e) => setOrderForm({ ...orderForm, customerName: e.target.value })}
                        style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
                      />
                    </div>

                    <div style={{ marginBottom: "12px" }}>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                        Contact Phone / WhatsApp
                      </label>
                      <input
                        type="tel"
                        placeholder="e.g. +91 98765 43210"
                        value={orderForm.customerPhone}
                        onChange={(e) => setOrderForm({ ...orderForm, customerPhone: e.target.value })}
                        style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
                      />
                    </div>

                    <div style={{ marginBottom: "12px" }}>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                        Shipping Address
                      </label>
                      <textarea
                        rows={2}
                        placeholder="e.g. 12 Temple Street, Madurai"
                        value={orderForm.shippingAddress}
                        onChange={(e) => setOrderForm({ ...orderForm, shippingAddress: e.target.value })}
                        style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px", resize: "none" }}
                      />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
                      <div>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                          Quantity
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={orderForm.quantity}
                          onChange={(e) => setOrderForm({ ...orderForm, quantity: Math.max(1, Number(e.target.value) || 1) })}
                          style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px" }}
                        />
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                          Payment Method
                        </label>
                        <select
                          value={orderForm.paymentMethod}
                          onChange={(e) => setOrderForm({ ...orderForm, paymentMethod: e.target.value })}
                          style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px", background: "#fff" }}
                        >
                          <option value="Direct UPI">UPI / GPay</option>
                          <option value="Cash on Delivery">Cash on Delivery</option>
                          <option value="Workshop Pickup">Workshop Pickup</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #E2E8F0", paddingTop: "12px", marginBottom: "16px" }}>
                      <span style={{ fontSize: "14px", color: "#64748B" }}>Total Order Amount:</span>
                      <strong style={{ fontSize: "18px", color: "#0F172A" }}>
                        {formatCurrency(
                          (selectedProduct.pricing?.recommendedPrice || selectedProduct.price || 0) * (orderForm.quantity || 1)
                        )}
                      </strong>
                    </div>

                    <button
                      type="submit"
                      disabled={orderSubmitting}
                      className="primary-button"
                      style={{ width: "100%", padding: "11px", fontSize: "14px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                    >
                      <ShoppingBag size={16} />
                      {orderSubmitting ? "Placing Order..." : "Place Customer Order"}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Catalogue;
