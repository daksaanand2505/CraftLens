const express = require("express");

const {
  readData,
  createRecord,
  findById,
  updateById,
  generateId,
  writeData,
} = require("../utils/storage.cjs");

const seedInventory = require("../data/inventory.cjs");

const router = express.Router();

const FILE = "inventory.json";

// GET inventory
router.get("/", (req, res) => {
  let inventory = readData(FILE, seedInventory);
  if (!inventory || inventory.length === 0) {
    inventory = seedInventory;
    writeData(FILE, inventory);
  }

  res.json({
    success: true,
    count: inventory.length,
    inventory,
  });
});

// GET inventory item
router.get("/:id", (req, res) => {
  const item = findById(FILE, req.params.id);

  if (!item) {
    return res.status(404).json({
      success: false,
      message: "Inventory item not found",
    });
  }

  res.json({
    success: true,
    item,
  });
});

// CREATE inventory item
router.post("/", (req, res) => {
  const item = {
    id: generateId("inventory"),
    artisanId: req.body.artisanId || "artisan-001",
    ...req.body,
    updatedAt: new Date().toISOString(),
  };

  createRecord(FILE, item);

  res.status(201).json({
    success: true,
    message: "Inventory item created successfully",
    item,
  });
});

// UPDATE inventory
router.put("/:id", (req, res) => {
  const item = updateById(
    FILE,
    req.params.id,
    req.body
  );

  if (!item) {
    return res.status(404).json({
      success: false,
      message: "Inventory item not found",
    });
  }

  res.json({
    success: true,
    message: "Inventory updated successfully",
    item,
  });
});

module.exports = router;