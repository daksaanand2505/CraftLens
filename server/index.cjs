const express = require("express");
const cors = require("cors");

const productRoutes = require("./routes/productRoutes.cjs");
const materialRoutes = require("./routes/materialRoutes.cjs");
const inventoryRoutes = require("./routes/inventoryRoutes.cjs");
const orderRoutes = require("./routes/orderRoutes.cjs");
const aiRoutes = require("./routes/aiRoutes.cjs");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "CraftLens backend is running",
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use("/api/products", productRoutes);
app.use("/api/materials", materialRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/ai", aiRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found",
    path: req.originalUrl,
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("CraftLens API Error:", err);

  res.status(500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

app.listen(PORT, () => {
  console.log("");
  console.log("========================================");
  console.log("          CRAFTLENS BACKEND");
  console.log("========================================");
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Health: http://localhost:${PORT}/api/health`);
  console.log("========================================");
  console.log("");
});