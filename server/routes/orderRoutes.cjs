const express = require("express");

const {
  readData,
  writeData,
  createRecord,
  findById,
  updateById,
  generateId,
} = require("../utils/storage.cjs");

const router = express.Router();

const FILE = "orders.json";
const INVENTORY_FILE = "inventory.json";

// GET all orders
router.get("/", (req, res) => {
  const orders = readData(FILE, []);

  res.json({
    success: true,
    count: orders.length,
    orders,
  });
});

// GET one order
router.get("/:id", (req, res) => {
  const order = findById(FILE, req.params.id);

  if (!order) {
    return res.status(404).json({
      success: false,
      message: "Order not found",
    });
  }

  res.json({
    success: true,
    order,
  });
});

// CREATE order with stock deduction
router.post("/", (req, res) => {
  const quantity = Number(req.body.quantity) || 1;
  if (quantity <= 0) {
    return res.status(400).json({
      success: false,
      message: "Quantity must be greater than zero",
    });
  }

  const price = Number(req.body.price || 0);
  const totalAmount = Number(req.body.totalAmount) || (price * quantity);
  const productId = req.body.productId || null;
  const productTitle = req.body.productTitle || req.body.item || "Handcrafted Product";

  // Check and deduct inventory stock
  const inventoryList = readData(INVENTORY_FILE, []);
  let stockUpdated = false;
  let remainingStock = null;

  const matchedInv = inventoryList.find(
    (inv) => (productId && String(inv.itemId) === String(productId)) ||
             (inv.itemName && inv.itemName.toLowerCase() === productTitle.toLowerCase())
  );

  if (matchedInv) {
    const prevStock = Number(matchedInv.quantity) || 0;
    matchedInv.quantity = Math.max(0, prevStock - quantity);
    matchedInv.updatedAt = new Date().toISOString();
    writeData(INVENTORY_FILE, inventoryList);
    stockUpdated = true;
    remainingStock = matchedInv.quantity;
  }

  const order = {
    id: generateId("order"),
    artisanId: req.body.artisanId || "artisan-001",
    productId,
    productTitle,
    customerName: req.body.customerName || "Customer",
    customerPhone: req.body.customerPhone || null,
    shippingAddress: req.body.shippingAddress || null,
    quantity,
    price,
    totalAmount,
    paymentMethod: req.body.paymentMethod || "Direct",
    status: req.body.status || "pending",
    stockDeducted: stockUpdated,
    remainingStock,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  createRecord(FILE, order);

  res.status(201).json({
    success: true,
    message: "Order created successfully",
    order,
    stockDeducted: stockUpdated,
    inventoryUpdated: stockUpdated,
    remainingStock,
  });
});

// UPDATE order
router.put("/:id", (req, res) => {
  const order = updateById(
    FILE,
    req.params.id,
    req.body
  );

  if (!order) {
    return res.status(404).json({
      success: false,
      message: "Order not found",
    });
  }

  res.json({
    success: true,
    message: "Order updated successfully",
    order,
  });
});

module.exports = router;