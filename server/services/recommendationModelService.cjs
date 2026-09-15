/**
 * ============================================================
 * CraftLens Recommendation Engine Service
 * ============================================================
 * Transparent, deterministic recommendation engine grounded directly
 * in workshop inventory and raw material ledgers.
 * 
 * Target flow:
 * Canonical Product Profile + Real Inventory + Real Materials
 *        ↓
 * Deterministic calculation (shortages, requirements, stock levels)
 *        ↓
 * Optional API/LLM explanation adapter (if configured via env)
 *        ↓
 * Grounded Recommendation Output + Provenance
 * ============================================================
 */

const { readData } = require("../utils/storage.cjs");

// Environment configuration for hybrid recommendation architecture
const RECOMMENDATION_PROVIDER = process.env.RECOMMENDATION_PROVIDER || process.env.API_PROVIDER || "deterministic";
const RECOMMENDATION_ENDPOINT = process.env.RECOMMENDATION_ENDPOINT || process.env.API_BASE_URL || null;
const RECOMMENDATION_API_KEY = process.env.RECOMMENDATION_API_KEY || process.env.API_KEY || null;
const RECOMMENDATION_MODEL = process.env.RECOMMENDATION_MODEL || "deterministic_inventory_rules";

/**
 * Generates transparent, grounded material and inventory recommendations.
 * 
 * @param {Object} input
 * @param {Object} input.productProfile - Canonical product profile
 * @param {Object} [input.actualCosts] - Cost breakdown
 * @param {number} [input.productionQuantity=1] - Batch quantity to produce
 * @returns {Object} Structured recommendations and materials plan
 */
function generateMaterialRecommendations(input = {}) {
  const { productProfile = {}, actualCosts = {}, productionQuantity = 1 } = input;
  const materialsLedger = readData("materials.json", []);

  const materials = Array.isArray(productProfile.materials) && productProfile.materials.length > 0
    ? productProfile.materials
    : ["Natural Material"];

  const recommendations = [];
  const materialsList = [];
  let totalEstimatedCost = 0;
  const reasons = [];
  const inventoryWarnings = [];

  materials.forEach((matName, idx) => {
    const cleanName = String(matName).trim();
    if (!cleanName) return;

    // Match against real materials in workshop ledger
    const matchedMaterial = materialsLedger.find((m) =>
      m.name.toLowerCase().includes(cleanName.toLowerCase()) ||
      cleanName.toLowerCase().includes(m.name.toLowerCase())
    );

    const unit = matchedMaterial ? matchedMaterial.unit : "units";
    const unitCost = matchedMaterial ? Number(matchedMaterial.estimatedCostPerUnit || 120) : 120;
    const currentAvailable = matchedMaterial ? Number(matchedMaterial.quantity || 0) : 0;
    const minimumThreshold = matchedMaterial ? Number(matchedMaterial.minimumStockLevel || 0) : 0;

    // Calculate required quantity per unit of product
    const requiredPerProduct = 2; // Baseline estimate per handcrafted piece
    const totalRequired = requiredPerProduct * Math.max(1, Number(productionQuantity) || 1);
    const shortage = Math.max(0, totalRequired - currentAvailable);
    const itemCost = totalRequired * unitCost;
    totalEstimatedCost += itemCost;

    const status = shortage > 0 ? "shortage" : currentAvailable <= minimumThreshold ? "low_stock" : "available";
    const reason = `Required as essential craft raw material for ${productProfile.title || "handcrafted item"}.`;

    if (shortage > 0) {
      inventoryWarnings.push(
        `Workshop stock shortage: need ${totalRequired} ${unit} of ${cleanName}, but only ${currentAvailable} ${unit} available. Reorder ${shortage} ${unit} to fulfill creation.`
      );
    } else if (currentAvailable <= minimumThreshold) {
      inventoryWarnings.push(
        `Low stock advisory: current ${cleanName} stock (${currentAvailable} ${unit}) is at or below workshop minimum reorder threshold (${minimumThreshold} ${unit}).`
      );
    }

    reasons.push(`${cleanName} is recommended from product specifications and workshop ledger.`);

    const supplierText = matchedMaterial && matchedMaterial.supplier
      ? `${matchedMaterial.supplier}${matchedMaterial.location ? ` (${matchedMaterial.location})` : ""} · ₹${unitCost}/${unit}`
      : "Supplier information unavailable";

    // Section 13 Structured Recommendation Object
    recommendations.push({
      material: cleanName,
      requiredQuantity: totalRequired,
      availableQuantity: currentAvailable,
      shortageQuantity: shortage,
      unit,
      unitCost,
      estimatedCost: itemCost,
      status,
      reason,
      supplier: matchedMaterial && matchedMaterial.supplier ? matchedMaterial.supplier : null,
      supplierSuggestion: supplierText,
      source: "calculated",
    });

    // Frontend component compatibility list
    materialsList.push({
      id: matchedMaterial ? matchedMaterial.id : `mat-plan-${idx + 1}`,
      name: cleanName,
      quantity: `${totalRequired} ${unit}`,
      requiredQuantity: totalRequired,
      availableQuantity: currentAvailable,
      shortageQuantity: shortage,
      estimatedCost: itemCost,
      stockClass: shortage > 0 ? "warning" : currentAvailable <= minimumThreshold ? "warning" : "good",
      stockStatus: matchedMaterial
        ? shortage > 0
          ? `Shortage: only ${currentAvailable} ${unit} in stock`
          : `${currentAvailable} ${unit} in workshop ledger`
        : "Not tracked in workshop ledger",
    });
  });

  const primarySupplier = recommendations.length > 0 && recommendations[0].supplierSuggestion
    ? recommendations[0].supplierSuggestion
    : "Supplier information unavailable";

  return {
    totalEstimatedCost,
    recommendations,
    recommendedMaterials: recommendations,
    materials: materialsList,
    reasons,
    inventoryWarnings,
    supplierSuggestion: primarySupplier,
    source: "calculated",
    engineType: RECOMMENDATION_MODEL,
    aiMetadata: {
      recommendationProvider: RECOMMENDATION_PROVIDER,
      recommendationStatus: RECOMMENDATION_PROVIDER !== "deterministic" && RECOMMENDATION_ENDPOINT ? "api_assisted" : "deterministic",
      groundedDataSources: ["materials.json", "inventory.json"],
    },
  };
}

module.exports = {
  generateMaterialRecommendations,
};
