/**
 * ============================================================
 * CraftLens Profit-Aware Pricing Service
 * ============================================================
 * Calculates deterministic pricing tiers strictly from entered costs.
 * 
 * Formula:
 * Total Cost = Material + Labour + Packaging + Platform + Overhead
 * Minimum Price: Total Cost × 1.15 (15% safety contingency)
 * Recommended Price: Total Cost × 1.50 (50% sustainable artisan profit)
 * Premium Price: Total Cost × 1.90 (90% craftsmanship & heritage margin)
 * ============================================================
 */

function roundToNearestTen(num) {
  return Math.round(num / 10) * 10;
}

function calculatePricing(input = {}) {
  const materialCost = Number(input.materialCost || 0);
  const labourCost = Number(input.labourCost || 0);
  const packagingCost = Number(input.packagingCost || 0);

  const platformCost = Number(
    input.platformCost ??
    input.platformFee ??
    0
  );

  const overheadCost = Number(
    input.overheadCost ??
    input.otherCosts ??
    0
  );

  const totalCost =
    materialCost +
    labourCost +
    packagingCost +
    platformCost +
    overheadCost;

  const minimumPrice = roundToNearestTen(totalCost * 1.15);
  const recommendedPrice = roundToNearestTen(totalCost * 1.50);
  const premiumPrice = roundToNearestTen(totalCost * 1.90);

  const artisanSellingPrice =
    input.artisanSellingPrice !== undefined && input.artisanSellingPrice !== null && !isNaN(Number(input.artisanSellingPrice))
      ? Number(input.artisanSellingPrice)
      : null;

  const comparison = artisanSellingPrice
    ? {
        artisanSellingPrice,
        differenceFromRecommended: artisanSellingPrice - recommendedPrice,
        percentageOfRecommended: Math.round((artisanSellingPrice / (recommendedPrice || 1)) * 100),
        status:
          artisanSellingPrice >= recommendedPrice
            ? "above_recommended"
            : artisanSellingPrice >= minimumPrice
            ? "sustainable"
            : "below_minimum",
        note:
          artisanSellingPrice >= recommendedPrice
            ? `Your spoken price (₹${artisanSellingPrice}) meets or exceeds the sustainable benchmark (₹${recommendedPrice}).`
            : artisanSellingPrice >= minimumPrice
            ? `Your spoken price (₹${artisanSellingPrice}) covers costs (₹${totalCost}) with fair margin.`
            : `Your spoken price (₹${artisanSellingPrice}) is below minimum cost threshold (₹${minimumPrice}). Recommended price is ₹${recommendedPrice}.`,
      }
    : null;

  return {
    currency: "INR",
    artisanSellingPrice,
    comparison,
    costs: {
      materialCost,
      labourCost,
      packagingCost,
      platformCost,
      overheadCost,
      totalCost,
    },
    minimumPrice,
    recommendedPrice,
    premiumPrice,
    pricingMethod: "cost_plus_formula",
    source: "calculated",
    validatedBy: "pricing_engine",
    reasoning: "Prices are calculated directly from your entered material, labour, packaging, and overhead costs with transparent artisan margins.",
    explanation: {
      minimum: "Covers base production costs with a 15% safety contingency.",
      recommended: "Ensures sustainable artisan livelihood with a 50% profit margin.",
      premium: "Premium positioning reflecting exceptional craftsmanship and story (90% margin).",
    },
  };
}

module.exports = {
  calculatePricing,
  roundToNearestTen,
};