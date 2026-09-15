const express = require("express");

const {
  readData,
  createRecord,
  findById,
  updateById,
  deleteById,
  generateId,
} = require("../utils/storage.cjs");

const router = express.Router();

const FILE = "products.json";

// GET all products
router.get("/", (req, res) => {
  const products = readData(FILE, []);

  res.json({
    success: true,
    count: products.length,
    products,
  });
});

// GET one product
router.get("/:id", (req, res) => {
  const product = findById(FILE, req.params.id);

  if (!product) {
    return res.status(404).json({
      success: false,
      message: "Product not found",
    });
  }

  res.json({
    success: true,
    product,
  });
});

// CREATE OR UPSERT product
router.post("/", (req, res) => {
  const existingId = req.body.id;
  if (existingId) {
    const existing = findById(FILE, existingId);
    if (existing) {
      const updated = updateById(FILE, existingId, {
        ...req.body,
        updatedAt: new Date().toISOString(),
      });
      return res.status(200).json({
        success: true,
        message: "Product updated successfully",
        product: updated,
      });
    }
  }

  const product = {
    id: existingId || generateId("product"),
    artisanId: req.body.artisanId || "artisan-001",
    status: req.body.status || "Published",
    ...req.body,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  createRecord(FILE, product);

  res.status(201).json({
    success: true,
    message: "Product created successfully",
    product,
  });
});

// UPDATE product
router.put("/:id", (req, res) => {
  const product = updateById(
    FILE,
    req.params.id,
    req.body
  );

  if (!product) {
    return res.status(404).json({
      success: false,
      message: "Product not found",
    });
  }

  res.json({
    success: true,
    message: "Product updated successfully",
    product,
  });
});

// DELETE product
router.delete("/:id", (req, res) => {
  const deleted = deleteById(FILE, req.params.id);

  if (!deleted) {
    return res.status(404).json({
      success: false,
      message: "Product not found",
    });
  }

  res.json({
    success: true,
    message: "Product deleted successfully",
  });
});

module.exports = router;