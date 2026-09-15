const express = require("express");

const {
  readData,
  createRecord,
  findById,
  updateById,
  deleteById,
  generateId,
  writeData,
} = require("../utils/storage.cjs");

const seedMaterials = require("../data/materials.cjs");

const router = express.Router();

const FILE = "materials.json";

// GET all materials
router.get("/", (req, res) => {
  let materials = readData(FILE, seedMaterials);
  if (!materials || materials.length === 0) {
    materials = seedMaterials;
    writeData(FILE, materials);
  }

  res.json({
    success: true,
    count: materials.length,
    materials,
  });
});

// GET one material
router.get("/:id", (req, res) => {
  const material = findById(FILE, req.params.id);

  if (!material) {
    return res.status(404).json({
      success: false,
      message: "Material not found",
    });
  }

  res.json({
    success: true,
    material,
  });
});

// CREATE material
router.post("/", (req, res) => {
  const material = {
    id: generateId("material"),
    artisanId: req.body.artisanId || "artisan-001",
    ...req.body,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  createRecord(FILE, material);

  res.status(201).json({
    success: true,
    message: "Material created successfully",
    material,
  });
});

// UPDATE material
router.put("/:id", (req, res) => {
  const material = updateById(
    FILE,
    req.params.id,
    req.body
  );

  if (!material) {
    return res.status(404).json({
      success: false,
      message: "Material not found",
    });
  }

  res.json({
    success: true,
    message: "Material updated successfully",
    material,
  });
});

// DELETE material
router.delete("/:id", (req, res) => {
  const deleted = deleteById(FILE, req.params.id);

  if (!deleted) {
    return res.status(404).json({
      success: false,
      message: "Material not found",
    });
  }

  res.json({
    success: true,
    message: "Material deleted successfully",
  });
});

module.exports = router;